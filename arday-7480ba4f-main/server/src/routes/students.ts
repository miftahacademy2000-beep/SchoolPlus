import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import {
  ensureSchoolAccess,
  isGlobalSuperAdmin,
  requireSchoolAccess,
  userHasSchoolRole,
} from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const createStudentSchema = z.object({
  school_id: z.string().min(1),
  user_id: z.string().min(1),
  enrollment_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  grade: z.string().optional(),
  parent_id: z.string().optional(),
  full_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
});

const updateStudentSchema = z.object({
  enrollment_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  grade: z.string().optional(),
  parent_id: z.string().optional(),
  full_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
});

router.get('/', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const schoolId = req.schoolId;
    const search = req.query.search as string | undefined;
    const classId = typeof req.query.class_id === 'string' ? req.query.class_id : undefined;
    const includeArchived = req.query.include_archived === 'true';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const superAdmin = schoolId ? false : await isGlobalSuperAdmin(req.user!.userId);
    const schoolRoles = schoolId
      ? await prisma.userRole.findMany({
          where: { userId: req.user!.userId, schoolId },
          select: { role: true },
        })
      : [];
    const canManage = superAdmin
      || (schoolId ? await userHasSchoolRole(req.user!.userId, schoolId, ['school_admin', 'teacher']) : false);
    const isStudent = schoolRoles.some(({ role }) => role === 'student');
    if (!canManage && !isStudent) {
      throw new AppError('You do not have permission to view students in this school', 403);
    }
    if (includeArchived && !superAdmin && !(schoolId && await userHasSchoolRole(req.user!.userId, schoolId, ['school_admin']))) {
      throw new AppError('Only school administrators can view archived students', 403);
    }

    const where: Record<string, unknown> = { ...(schoolId && { schoolId }), ...(!includeArchived && { archived_at: null }) };
    if (!canManage) where.userId = req.user!.userId;
    if (classId) {
      where.classStudents = {
        some: {
          classId,
          ...(schoolId && { class: { schoolId } }),
        },
      };
    }
    if (search) {
      where.OR = [
        { profile: { fullName: { contains: search } } },
        { profile: { email: { contains: search } } },
        { enrollmentNumber: { contains: search } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          profile: {
            select: { id: true, fullName: true, email: true, loginId: true, phone: true, avatarUrl: true },
          },
          classStudents: {
            where: {
              ...(classId && { classId }),
              class: { schoolId },
            },
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  grade: true,
                  section: true,
                  schoolId: true,
                  class_fees: { where: { school_id: schoolId }, select: { monthly_fee: true } },
                },
              },
            },
          },
          studentFeeOverrides: {
            where: { schoolId },
            select: { monthlyFee: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.student.count({ where }),
    ]);

    res.json({
      data: students,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list students' });
  }
});

router.get('/portal', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const student = await prisma.student.findFirst({
      where: { userId, archived_at: null },
      include: {
        profile: {
          select: { id: true, fullName: true, email: true, loginId: true, phone: true, avatarUrl: true },
        },
        schools: { select: { id: true, name: true, logoUrl: true } },
      },
    });

    if (!student) {
      throw new AppError('Student profile not found', 404);
    }

    res.json({ data: student });
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

    const schoolId = req.schoolId;
    const canManage = schoolId
      ? await userHasSchoolRole(req.user!.userId, schoolId, ['school_admin', 'teacher'])
      : await isGlobalSuperAdmin(req.user!.userId);
    const student = await prisma.student.findFirst({
      where: { id, ...(schoolId && { schoolId }), archived_at: null, ...(!canManage ? { userId: req.user!.userId } : {}) },
      include: {
        profile: {
          select: { id: true, fullName: true, email: true, loginId: true, phone: true, avatarUrl: true },
        },
        invoices: {
          where: { schoolId },
          include: {
            paymentHistory: {
              select: { id: true, amount: true, paymentMethod: true, notes: true, createdAt: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        attendance: {
          where: { class: { schoolId } },
          include: { class: { select: { id: true, name: true, grade: true, section: true } } },
          orderBy: { date: 'desc' },
          take: 30,
        },
        exams: {
          where: { student_id: id, school_id: schoolId },
          include: {
            exam_types: { select: { id: true, name: true } },
            subjects: { select: { id: true, name: true } },
            terms: { select: { id: true, name: true } },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }
    await ensureSchoolAccess(req, student.schoolId, canManage ? ['school_admin', 'teacher'] : undefined);
    if (!canManage && !await userHasSchoolRole(req.user!.userId, student.schoolId, ['student'])) {
      throw new AppError('You do not have permission to view this student', 403);
    }

    res.json({ data: student });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get student' });
  }
});

router.post('/', requireAuth, requireSchoolAccess, validate(createStudentSchema), async (req: Request, res: Response) => {
  try {
    const {
      school_id, user_id, enrollment_number, date_of_birth,
      grade, parent_id, full_name, email, phone, avatar_url,
    } = req.body;

    if (!await userHasSchoolRole(req.user!.userId, school_id, ['school_admin'])) {
      throw new AppError('Only school administrators can create student records', 403);
    }
    await ensureSchoolAccess(req, school_id, ['school_admin']);

    const existingStudent = await prisma.student.findFirst({
      where: { userId: user_id, schoolId: school_id },
    });
    if (existingStudent) {
      throw new AppError('Student already exists in this school', 400);
    }

    const normalizedEnrollment = typeof enrollment_number === 'string'
      ? enrollment_number.trim()
      : undefined;
    if (normalizedEnrollment) {
      const duplicateEnrollment = await prisma.student.findFirst({
        where: { schoolId: school_id, enrollmentNumber: normalizedEnrollment },
        select: { id: true },
      });
      if (duplicateEnrollment) {
        throw new AppError('A student with this enrollment number already exists in this school', 409);
      }
    }

    if (parent_id) {
      const parent = await prisma.parent.findFirst({
        where: { id: parent_id, schoolId: school_id },
        select: { id: true },
      });
      if (!parent) {
        throw new AppError('Parent not found in this school', 400);
      }
    }

    const student = await prisma.$transaction(async (tx) => {
      if (full_name || email || phone || avatar_url) {
        await tx.profile.upsert({
          where: { id: user_id },
          create: {
            id: user_id,
            fullName: full_name,
            email,
            phone,
            avatarUrl: avatar_url,
            createdAt: new Date(),
            mustChangePassword: false,
            preferredLanguage: 'en',
          },
          update: {
            ...(full_name && { fullName: full_name }),
            ...(email && { email }),
            ...(phone && { phone }),
            ...(avatar_url && { avatarUrl: avatar_url }),
          },
        });
      }

      return tx.student.create({
        data: {
          userId: user_id,
          schoolId: school_id,
          enrollmentNumber: normalizedEnrollment ?? '',
          dateOfBirth: date_of_birth ? new Date(date_of_birth) : null,
          grade,
          parentId: parent_id,
          createdAt: new Date(),
        },
        include: {
          profile: {
            select: { id: true, fullName: true, email: true, loginId: true, phone: true, avatarUrl: true },
          },
        },
      });
    });

    await logAuditEvent({
      action: 'CREATE',
      entityType: 'Student',
      entityId: student.id,
      entityName: full_name,
      schoolId: school_id,
      userId: req.user!.userId,
    });

    res.status(201).json({ data: student });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create student' });
  }
});

router.put('/:id', requireAuth, requireSchoolAccess, validate(updateStudentSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enrollment_number, date_of_birth, grade, parent_id, full_name, email, phone, avatar_url } = req.body;

    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Student not found', 404);
    }
    if (!await userHasSchoolRole(req.user!.userId, existing.schoolId, ['school_admin'])) {
      throw new AppError('Only school administrators can update student records', 403);
    }
    await ensureSchoolAccess(req, existing.schoolId, ['school_admin']);

    const normalizedEnrollment = typeof enrollment_number === 'string'
      ? enrollment_number.trim()
      : undefined;
    if (normalizedEnrollment && normalizedEnrollment !== existing.enrollmentNumber) {
      const duplicateEnrollment = await prisma.student.findFirst({
        where: {
          schoolId: existing.schoolId,
          enrollmentNumber: normalizedEnrollment ?? '',
          NOT: { id },
        },
        select: { id: true },
      });
      if (duplicateEnrollment) {
        throw new AppError('A student with this enrollment number already exists in this school', 409);
      }
    }

    if (parent_id !== undefined && parent_id !== null) {
      const parent = await prisma.parent.findFirst({
        where: { id: parent_id, schoolId: existing.schoolId },
        select: { id: true },
      });
      if (!parent) {
        throw new AppError('Parent not found in this school', 400);
      }
    }

    const student = await prisma.$transaction(async (tx) => {
      if (full_name || email || phone || avatar_url) {
        await tx.profile.update({
          where: { id: existing.userId },
          data: {
            ...(full_name && { fullName: full_name }),
            ...(email && { email }),
            ...(phone && { phone }),
            ...(avatar_url && { avatarUrl: avatar_url }),
          },
        });
      }

      return tx.student.update({
        where: { id },
        data: {
          ...(enrollment_number !== undefined && { enrollmentNumber: normalizedEnrollment as string }),
          ...(date_of_birth !== undefined && { dateOfBirth: date_of_birth ? new Date(date_of_birth) : null }),
          ...(grade !== undefined && { grade }),
          ...(parent_id !== undefined && { parentId: parent_id || null }),
        },
        include: {
          profile: {
            select: { id: true, fullName: true, email: true, loginId: true, phone: true, avatarUrl: true },
          },
        },
      });
    });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'Student',
      entityId: student.id,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: student });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update student' });
  }
});

router.delete('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        profile: {
          select: { id: true, fullName: true, email: true, loginId: true, phone: true, avatarUrl: true },
        },
      },
    });
    if (!student) {
      throw new AppError('Student not found', 404);
    }
    if (student.archived_at) {
      throw new AppError('Student is already archived', 409);
    }
    if (!await userHasSchoolRole(req.user!.userId, student.schoolId, ['school_admin'])) {
      throw new AppError('Only school administrators can archive students', 403);
    }
    await ensureSchoolAccess(req, student.schoolId, ['school_admin']);

    await prisma.$transaction(async (tx) => {
      await tx.archivedUser.create({
        data: {
          originalId: student.id,
          userId: student.userId,
          schoolId: student.schoolId,
          userType: 'student',
          fullName: student.profile?.fullName,
          email: student.profile?.email,
          phone: student.profile?.phone,
          avatarUrl: student.profile?.avatarUrl,
          metadata: JSON.stringify({
            enrollmentNumber: student.enrollmentNumber,
            grade: student.grade,
          }),
          archivedBy: req.user!.userId,
          archivedAt: new Date(),
        },
      });

      await tx.student.update({
        where: { id },
        data: { archived_at: new Date() },
      });
    });

    await logAuditEvent({
      action: 'ARCHIVE',
      entityType: 'Student',
      entityId: student.id,
      entityName: student.profile?.fullName ?? undefined,
      schoolId: student.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Student archived successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to archive student' });
  }
});

router.get('/:id/exam-results', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const schoolId = req.schoolId;

    const canManage = schoolId
      ? await userHasSchoolRole(req.user!.userId, schoolId, ['school_admin', 'teacher'])
      : await isGlobalSuperAdmin(req.user!.userId);
    const student = await prisma.student.findFirst({
      where: { id, ...(schoolId && { schoolId }), archived_at: null, ...(!canManage ? { userId: req.user!.userId } : {}) },
      include: {
        profile: {
          select: { id: true, fullName: true, email: true, loginId: true, phone: true, avatarUrl: true },
        },
      },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }
    await ensureSchoolAccess(req, student.schoolId, canManage ? ['school_admin', 'teacher'] : undefined);
    if (!canManage && !await userHasSchoolRole(req.user!.userId, student.schoolId, ['student'])) {
      throw new AppError('You do not have permission to view this student', 403);
    }

    const examResults = await prisma.exams.findMany({
      where: { student_id: student.id, school_id: student.schoolId },
      include: {
        exam_types: { select: { id: true, name: true } },
        subjects: { select: { id: true, name: true } },
        terms: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json({ data: { student, examResults } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get exam results' });
  }
});

export default router;
