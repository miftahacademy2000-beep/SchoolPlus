import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const createParentSchema = z.object({
  school_id: z.string().min(1),
  user_id: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  full_name: z.string().optional(),
  email: z.string().email().optional(),
  avatar_url: z.string().optional(),
});

const updateParentSchema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  full_name: z.string().optional(),
  email: z.string().email().optional(),
  avatar_url: z.string().optional(),
});

const linkStudentSchema = z.object({
  student_id: z.string().min(1),
  relationship: z.string().optional(),
});

router.get('/', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const schoolId = req.query.school_id as string;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { schoolId };
    if (search) {
      where.OR = [
        { profile: { fullName: { contains: search } } },
        { profile: { email: { contains: search } } },
      ];
    }

    const [parents, total] = await Promise.all([
      prisma.parent.findMany({
        where,
        include: { profile: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.parent.count({ where }),
    ]);

    const parentStudents = await prisma.parentStudent.findMany({
      where: { parentId: { in: parents.map((parent) => parent.id) }, student: { schoolId } },
      include: { student: { include: { profile: true } } },
    });
    const data = parents.map((parent) => ({
      ...parent,
      parentStudents: parentStudents.filter((link) => link.parentId === parent.id),
    }));

    res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list parents' });
  }
});

router.get('/portal', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const parent = await prisma.parent.findFirst({
      where: { userId },
      include: { profile: true },
    });

    if (!parent) {
      throw new AppError('Parent profile not found', 404);
    }

    const parentStudents = await prisma.parentStudent.findMany({
      where: { parentId: parent.id, student: { schoolId: parent.schoolId } },
      include: {
        student: {
          include: {
            profile: true,
            classStudents: {
              include: { class: { include: { timetableSlots: { include: { course: true } } } } },
            },
            grades: { include: { course: true } },
            attendance: { orderBy: { date: 'desc' }, take: 30 },
            invoices: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });

    res.json({ data: { ...parent, parentStudents } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get portal data' });
  }
});

router.get('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const parent = await prisma.parent.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });

    if (!parent) {
      throw new AppError('Parent not found', 404);
    }

    const parentStudents = await prisma.parentStudent.findMany({
      where: { parentId: parent.id, student: { schoolId: parent.schoolId } },
      include: { student: { include: { profile: true } } },
    });

    res.json({ data: { ...parent, parentStudents } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get parent' });
  }
});

router.post('/', requireAuth, requireSchoolAccess, validate(createParentSchema), async (req: Request, res: Response) => {
  try {
    const { school_id, user_id, phone, address, occupation, full_name, email, avatar_url } = req.body;

    const existing = await prisma.parent.findFirst({ where: { userId: user_id, schoolId: school_id } });
    if (existing) {
      throw new AppError('Parent already exists in this school', 400);
    }

    const parent = await prisma.$transaction(async (tx) => {
      if (full_name || email || avatar_url) {
        await tx.profile.upsert({
          where: { id: user_id },
          create: {
            id: user_id,
            fullName: full_name,
            email,
            avatarUrl: avatar_url,
            createdAt: new Date(),
            mustChangePassword: false,
            preferredLanguage: 'en',
          },
          update: {
            ...(full_name && { fullName: full_name }),
            ...(email && { email }),
            ...(avatar_url && { avatarUrl: avatar_url }),
          },
        });
      }

      return tx.parent.create({
        data: {
          userId: user_id,
          schoolId: school_id,
          phone: phone ? BigInt(phone) : 0n,
          address,
          occupation,
          createdAt: new Date(),
        },
        include: { profile: true },
      });
    });

    await logAuditEvent({
      action: 'CREATE',
      entityType: 'Parent',
      entityId: parent.id,
      entityName: full_name,
      schoolId: school_id,
      userId: req.user!.userId,
    });

    res.status(201).json({ data: parent });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create parent' });
  }
});

router.put('/:id', requireAuth, requireSchoolAccess, validate(updateParentSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { phone, address, occupation, full_name, email, avatar_url } = req.body;

    const existing = await prisma.parent.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Parent not found', 404);
    }

    const parent = await prisma.$transaction(async (tx) => {
      if (full_name || email || avatar_url) {
        await tx.profile.update({
          where: { id: existing.userId },
          data: {
            ...(full_name && { fullName: full_name }),
            ...(email && { email }),
            ...(avatar_url && { avatarUrl: avatar_url }),
          },
        });
      }

      return tx.parent.update({
        where: { id },
        data: {
          ...(phone !== undefined && { phone: BigInt(phone) }),
          ...(address !== undefined && { address }),
          ...(occupation !== undefined && { occupation }),
        },
        include: { profile: true },
      });
    });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'Parent',
      entityId: parent.id,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: parent });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update parent' });
  }
});

router.delete('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const parent = await prisma.parent.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!parent) {
      throw new AppError('Parent not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.archivedUser.create({
        data: {
          originalId: parent.id,
          userId: parent.userId,
          schoolId: parent.schoolId,
          userType: 'parent',
          fullName: parent.profile?.fullName,
          email: parent.profile?.email,
          phone: String(parent.phone),
          avatarUrl: parent.profile?.avatarUrl,
          metadata: JSON.stringify({ occupation: parent.occupation }),
          archivedBy: req.user!.userId,
          archivedAt: new Date(),
        },
      });

      await tx.parentStudent.deleteMany({ where: { parentId: id } });
      await tx.parent.delete({ where: { id } });
      await tx.profile.delete({ where: { id: parent.userId } });
    });

    await logAuditEvent({
      action: 'ARCHIVE',
      entityType: 'Parent',
      entityId: parent.id,
      entityName: parent.profile?.fullName ?? undefined,
      schoolId: parent.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Parent archived successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to archive parent' });
  }
});

router.post('/:id/link-student', requireAuth, requireSchoolAccess, validate(linkStudentSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { student_id, relationship } = req.body;

    const parent = await prisma.parent.findUnique({ where: { id } });
    if (!parent) {
      throw new AppError('Parent not found', 404);
    }

    const student = await prisma.student.findUnique({ where: { id: student_id } });
    if (!student) {
      throw new AppError('Student not found', 404);
    }

    const existingLink = await prisma.parentStudent.findFirst({
      where: { parentId: id, studentId: student_id, student: { schoolId: parent.schoolId } },
    });
    if (existingLink) {
      throw new AppError('Parent is already linked to this student', 400);
    }

    const link = await prisma.parentStudent.create({
      data: {
        parentId: id,
        studentId: student_id,
        relationship: relationship ?? 'parent',
        createdAt: new Date(),
      },
      include: { student: { include: { profile: true } } },
    });

    await logAuditEvent({
      action: 'LINK',
      entityType: 'ParentStudent',
      entityId: link.id,
      schoolId: parent.schoolId,
      userId: req.user!.userId,
      details: { parentId: id, studentId: student_id },
    });

    res.status(201).json({ data: link });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to link student' });
  }
});

router.delete('/:id/unlink-student/:studentId', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id, studentId } = req.params;

    const parent = await prisma.parent.findUnique({ where: { id } });
    if (!parent) {
      throw new AppError('Parent not found', 404);
    }

    const link = await prisma.parentStudent.findFirst({
      where: { parentId: id, studentId, student: { schoolId: parent.schoolId } },
    });
    if (!link) {
      throw new AppError('Link not found', 404);
    }

    await prisma.parentStudent.delete({ where: { id: link.id } });

    await logAuditEvent({
      action: 'UNLINK',
      entityType: 'ParentStudent',
      entityId: link.id,
      schoolId: parent.schoolId,
      userId: req.user!.userId,
      details: { parentId: id, studentId },
    });

    res.json({ data: { message: 'Student unlinked successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to unlink student' });
  }
});

export default router;
