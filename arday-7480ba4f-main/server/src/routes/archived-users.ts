import { Router, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

function parseMetadata(metadata: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(metadata);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function canManageSchool(userId: string, schoolId: string): Promise<boolean> {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true, schoolId: true },
  });
  return roles.some((role) =>
    (role.role === 'super_admin' && role.schoolId === null)
    || (role.role === 'school_admin' && role.schoolId === schoolId),
  );
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const schoolId = req.query.school_id as string;
    const userType = req.query.user_type as string;
    const roles = await prisma.userRole.findMany({
      where: { userId: req.user!.userId },
      select: { role: true, schoolId: true },
    });
    const isSuperAdmin = roles.some(({ role, schoolId: roleSchoolId }) =>
      role === 'super_admin' && roleSchoolId === null);
    if (!isSuperAdmin && (!schoolId || !await canManageSchool(req.user!.userId, schoolId))) {
      throw new AppError('You do not have permission to view archived users for this school', 403);
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (schoolId) where.schoolId = schoolId;
    if (userType) where.userType = userType;

    const [users, total] = await Promise.all([
      prisma.archivedUser.findMany({
        where,
        skip,
        take: limit,
        orderBy: { archivedAt: 'desc' },
      }),
      prisma.archivedUser.count({ where }),
    ]);

    res.json({ data: users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list archived users' });
  }
});

router.post('/restore/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const archived = await prisma.archivedUser.findUnique({ where: { id } });
    if (!archived) {
      throw new AppError('Archived user not found', 404);
    }
    if (!archived.schoolId || !await canManageSchool(req.user!.userId, archived.schoolId)) {
      throw new AppError('You do not have permission to restore this user', 403);
    }
    if (!archived.userId) {
      throw new AppError('The archived account is missing its user identifier', 409);
    }

    const schoolId = archived.schoolId;
    const userId = archived.userId;
    const metadata = parseMetadata(archived.metadata);

    const result = await prisma.$transaction(async (tx) => {
      let restoredRecord: unknown = null;

      if (archived.userType !== 'student') {
        await tx.profile.upsert({
          where: { id: userId },
          create: {
            id: userId,
            fullName: archived.fullName,
            email: archived.email,
            phone: archived.phone,
            avatarUrl: archived.avatarUrl,
            createdAt: new Date(),
            mustChangePassword: false,
            preferredLanguage: 'en',
          },
          update: {
            fullName: archived.fullName,
            email: archived.email,
            phone: archived.phone,
            avatarUrl: archived.avatarUrl,
          },
        });
      }

      if (archived.userType === 'student') {
        const existingStudent = await tx.student.findFirst({
          where: {
            OR: [
              { id: archived.originalId },
              { userId, schoolId },
            ],
          },
        });
        if (existingStudent) {
          const duplicate = await tx.student.findFirst({
            where: {
              schoolId,
              enrollmentNumber: existingStudent.enrollmentNumber,
              id: { not: existingStudent.id },
            },
          });
          if (duplicate) {
            throw new AppError('Another student already uses this enrollment number in the school', 409);
          }
          restoredRecord = await tx.student.update({
            where: { id: existingStudent.id },
            data: { archived_at: null },
          });
        } else {
          const profile = await tx.profile.findUnique({ where: { id: userId } });
          if (!profile) {
            throw new AppError(
              'This legacy archive no longer has its original password hash; restore its account data from backup before restoring it',
              409,
            );
          }
          restoredRecord = await tx.student.create({
            data: {
              id: archived.originalId,
              userId,
              schoolId,
              enrollmentNumber: String(metadata.enrollmentNumber || ''),
              grade: typeof metadata.grade === 'string' ? metadata.grade : null,
              createdAt: new Date(),
            },
          });
        }
      } else if (archived.userType === 'teacher') {
        restoredRecord = await tx.teacher.create({
          data: {
            id: archived.originalId,
            userId,
            schoolId,
            employeeId: typeof metadata.employeeId === 'string' ? metadata.employeeId : archived.originalId,
            department: typeof metadata.department === 'string' ? metadata.department : null,
            shift: 'morning',
            status: 'active',
            createdAt: new Date(),
          },
        });
      } else if (archived.userType === 'parent') {
        restoredRecord = await tx.parent.create({
          data: {
            id: archived.originalId,
            userId,
            schoolId,
            phone: archived.phone ? BigInt(archived.phone) : 0n,
            occupation: typeof metadata.occupation === 'string' ? metadata.occupation : null,
            createdAt: new Date(),
          },
        });
      }

      await tx.archivedUser.delete({ where: { id } });

      return restoredRecord;
    });

    await logAuditEvent({
      action: 'RESTORE',
      entityType: 'ArchivedUser',
      entityId: archived.originalId,
      entityName: archived.fullName ?? undefined,
      schoolId: archived.schoolId ?? undefined,
      userId: req.user!.userId,
    });

    res.json({ data: result });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to restore user' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const archived = await prisma.archivedUser.findUnique({ where: { id } });
    if (!archived) {
      throw new AppError('Archived user not found', 404);
    }
    if (!archived.schoolId || !await canManageSchool(req.user!.userId, archived.schoolId)) {
      throw new AppError('You do not have permission to permanently delete this user', 403);
    }

    await prisma.archivedUser.delete({ where: { id } });

    await logAuditEvent({
      action: 'PERMANENT_DELETE',
      entityType: 'ArchivedUser',
      entityId: archived.originalId,
      entityName: archived.fullName ?? undefined,
      schoolId: archived.schoolId ?? undefined,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Archived user permanently deleted' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete archived user' });
  }
});

export default router;
