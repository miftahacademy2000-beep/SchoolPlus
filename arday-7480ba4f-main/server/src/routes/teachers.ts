import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const createTeacherSchema = z.object({
  school_id: z.string().min(1),
  user_id: z.string().min(1),
  employee_id: z.string().optional(),
  department: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  full_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
});

const updateTeacherSchema = z.object({
  employee_id: z.string().optional(),
  department: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  full_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
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
        { employeeId: { contains: search } },
      ];
    }

    const [teachers, total] = await Promise.all([
      prisma.teacher.findMany({
        where,
        include: { profile: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.teacher.count({ where }),
    ]);

    res.json({ data: teachers, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list teachers' });
  }
});

router.get('/portal', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const teacher = await prisma.teacher.findFirst({
      where: { userId },
      include: {
        profile: true,
        classTeachers: {
          include: {
            class: {
              include: {
                classStudents: { include: { student: { include: { profile: true } } } },
              },
            },
          },
        },
        courses: true,
        timetableSlots: { include: { class: true, course: true } },
        assignments: { include: { course: true, submissions: true } },
      },
    });

    if (!teacher) {
      throw new AppError('Teacher profile not found', 404);
    }

    res.json({ data: teacher });
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

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!teacher) {
      throw new AppError('Teacher not found', 404);
    }

    res.json({ data: teacher });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get teacher' });
  }
});

router.post('/', requireAuth, requireSchoolAccess, validate(createTeacherSchema), async (req: Request, res: Response) => {
  try {
    const { school_id, user_id, employee_id, department, subjects, full_name, email, phone, avatar_url } = req.body;

    const existing = await prisma.teacher.findFirst({ where: { userId: user_id, schoolId: school_id } });
    if (existing) {
      throw new AppError('Teacher already exists in this school', 400);
    }

    const teacher = await prisma.$transaction(async (tx) => {
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

      return tx.teacher.create({
        data: {
          userId: user_id,
          schoolId: school_id,
          employeeId: employee_id,
          department,
          subjects: subjects ?? undefined,
          shift: 'morning',
          status: 'active',
          createdAt: new Date(),
        },
        include: { profile: true },
      });
    });

    await logAuditEvent({
      action: 'CREATE',
      entityType: 'Teacher',
      entityId: teacher.id,
      entityName: full_name,
      schoolId: school_id,
      userId: req.user!.userId,
    });

    res.status(201).json({ data: teacher });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create teacher' });
  }
});

router.put('/:id', requireAuth, requireSchoolAccess, validate(updateTeacherSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { employee_id, department, subjects, full_name, email, phone, avatar_url } = req.body;

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Teacher not found', 404);
    }

    const teacher = await prisma.$transaction(async (tx) => {
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

      return tx.teacher.update({
        where: { id },
        data: {
          ...(employee_id !== undefined && { employeeId: employee_id }),
          ...(department !== undefined && { department }),
          ...(subjects !== undefined && { subjects }),
        },
        include: { profile: true },
      });
    });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'Teacher',
      entityId: teacher.id,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: teacher });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

router.delete('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!teacher) {
      throw new AppError('Teacher not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.archivedUser.create({
        data: {
          originalId: teacher.id,
          userId: teacher.userId,
          schoolId: teacher.schoolId,
          userType: 'teacher',
          fullName: teacher.profile?.fullName,
          email: teacher.profile?.email,
          phone: teacher.profile?.phone,
          avatarUrl: teacher.profile?.avatarUrl,
          metadata: JSON.stringify({ employeeId: teacher.employeeId, department: teacher.department }),
          archivedBy: req.user!.userId,
          archivedAt: new Date(),
        },
      });

      await tx.classTeacher.deleteMany({ where: { teacherId: id } });
      await tx.timetableSlot.deleteMany({ where: { teacherId: id } });
      await tx.learningMaterial.deleteMany({ where: { teacherId: id } });
      await tx.course.updateMany({ where: { teacherId: id }, data: { teacherId: null } });
      await tx.class.updateMany({ where: { teacherId: id }, data: { teacherId: null } });
      await tx.assignment.updateMany({ where: { teacherId: id }, data: { teacherId: null } });

      await tx.teacher.delete({ where: { id } });
      await tx.profile.delete({ where: { id: teacher.userId } });
    });

    await logAuditEvent({
      action: 'ARCHIVE',
      entityType: 'Teacher',
      entityId: teacher.id,
      entityName: teacher.profile?.fullName ?? undefined,
      schoolId: teacher.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Teacher archived successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to archive teacher' });
  }
});

export default router;
