import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const createGradeSchema = z.object({
  student_id: z.string().min(1),
  course_id: z.string().min(1),
  grade_type: z.string().min(1),
  title: z.string().min(1),
  score: z.number().min(0),
  max_score: z.number().min(1).default(100),
  weight: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
});

const updateGradeSchema = z.object({
  score: z.number().min(0).optional(),
  max_score: z.number().min(1).optional(),
  weight: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
  title: z.string().optional(),
});

router.get('/', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const courseId = req.query.course_id as string;
    const studentId = req.query.student_id as string;
    const schoolId = req.query.school_id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (courseId) where.courseId = courseId;
    if (studentId) where.studentId = studentId;
    if (schoolId) {
      where.course = { schoolId };
    }

    const [grades, total] = await Promise.all([
      prisma.grade.findMany({
        where,
        include: {
          student: { include: { profile: true } },
          course: true,
          grader: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.grade.count({ where }),
    ]);

    res.json({ data: grades, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list grades' });
  }
});

router.post('/', requireAuth, requireSchoolAccess, validate(createGradeSchema), async (req: Request, res: Response) => {
  try {
    const { student_id, course_id, grade_type, title, score, max_score, weight, notes } = req.body;

    const grade = await prisma.grade.create({
      data: {
        studentId: student_id,
        courseId: course_id,
        gradeType: grade_type,
        title,
        score,
        maxScore: max_score,
        weight,
        notes,
        gradedBy: req.user!.userId,
        gradedAt: new Date(),
        createdAt: new Date(),
      },
      include: {
        student: { include: { profile: true } },
        course: true,
      },
    });

    await logAuditEvent({
      action: 'CREATE',
      entityType: 'Grade',
      entityId: grade.id,
      entityName: title,
      userId: req.user!.userId,
    });

    res.status(201).json({ data: grade });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create grade' });
  }
});

router.put('/:id', requireAuth, requireSchoolAccess, validate(updateGradeSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { score, max_score, weight, notes, title } = req.body;

    const existing = await prisma.grade.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Grade not found', 404);
    }

    const grade = await prisma.grade.update({
      where: { id },
      data: {
        ...(score !== undefined && { score }),
        ...(max_score !== undefined && { maxScore: max_score }),
        ...(weight !== undefined && { weight }),
        ...(notes !== undefined && { notes }),
        ...(title !== undefined && { title }),
        gradedBy: req.user!.userId,
      },
      include: {
        student: { include: { profile: true } },
        course: true,
      },
    });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'Grade',
      entityId: grade.id,
      userId: req.user!.userId,
    });

    res.json({ data: grade });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update grade' });
  }
});

router.delete('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.grade.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Grade not found', 404);
    }

    await prisma.grade.delete({ where: { id } });

    await logAuditEvent({
      action: 'DELETE',
      entityType: 'Grade',
      entityId: id,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Grade deleted successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete grade' });
  }
});

export default router;
