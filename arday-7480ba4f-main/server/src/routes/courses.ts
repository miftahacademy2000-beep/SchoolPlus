import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const createCourseSchema = z.object({
  school_id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  teacher_id: z.string().optional(),
  credits: z.number().int().optional(),
});

const updateCourseSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  description: z.string().optional(),
  teacher_id: z.string().optional(),
  credits: z.number().int().optional(),
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
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: { teacher: { include: { profile: true } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.course.count({ where }),
    ]);

    res.json({ data: courses, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list courses' });
  }
});

router.get('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        teacher: { include: { profile: true } },
        timetableSlots: { include: { class: true } },
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    res.json({ data: course });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get course' });
  }
});

router.post('/', requireAuth, requireSchoolAccess, validate(createCourseSchema), async (req: Request, res: Response) => {
  try {
    const { school_id, name, code, description, teacher_id, credits } = req.body;

    const existing = await prisma.course.findFirst({ where: { code, schoolId: school_id } });
    if (existing) {
      throw new AppError('Course code already exists in this school', 400);
    }

    const course = await prisma.course.create({
      data: {
        name,
        code,
        description,
        schoolId: school_id,
        teacherId: teacher_id,
        credits,
        createdAt: new Date(),
      },
      include: { teacher: { include: { profile: true } } },
    });

    await logAuditEvent({
      action: 'CREATE',
      entityType: 'Course',
      entityId: course.id,
      entityName: name,
      schoolId: school_id,
      userId: req.user!.userId,
    });

    res.status(201).json({ data: course });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.put('/:id', requireAuth, requireSchoolAccess, validate(updateCourseSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, description, teacher_id, credits } = req.body;

    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Course not found', 404);
    }

    if (code && code !== existing.code) {
      const duplicate = await prisma.course.findFirst({
        where: { code, schoolId: existing.schoolId, NOT: { id } },
      });
      if (duplicate) {
        throw new AppError('Course code already exists', 400);
      }
    }

    const course = await prisma.course.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(teacher_id !== undefined && { teacherId: teacher_id }),
        ...(credits !== undefined && { credits }),
      },
      include: { teacher: { include: { profile: true } } },
    });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'Course',
      entityId: course.id,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: course });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update course' });
  }
});

router.delete('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Course not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.timetableSlot.deleteMany({ where: { courseId: id } });
      await tx.learningMaterial.deleteMany({ where: { courseId: id } });
      await tx.grade.deleteMany({ where: { courseId: id } });
      await tx.assignment.deleteMany({ where: { courseId: id } });
      await tx.course.delete({ where: { id } });
    });

    await logAuditEvent({
      action: 'DELETE',
      entityType: 'Course',
      entityId: id,
      entityName: existing.name,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Course deleted successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

router.get('/:id/students', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const grades = await prisma.grade.findMany({
      where: { courseId: id },
      distinct: ['studentId'],
      include: { student: { include: { profile: true } } },
    });

    res.json({ data: grades.map((g) => g.student) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get enrolled students' });
  }
});

router.get('/:id/materials', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const materials = await prisma.learningMaterial.findMany({
      where: { courseId: id },
      include: { teacher: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: materials });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get materials' });
  }
});

export default router;
