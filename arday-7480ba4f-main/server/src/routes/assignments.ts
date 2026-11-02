import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const createAssignmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  course_id: z.string().min(1),
  class_id: z.string().optional(),
  assignment_type: z.string().default('homework'),
  due_date: z.string().min(1),
  max_score: z.number().min(1).default(100),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  attachments: z.any().optional(),
});

const updateAssignmentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assignment_type: z.string().optional(),
  due_date: z.string().optional(),
  max_score: z.number().min(1).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  attachments: z.any().optional(),
});

router.get('/', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const schoolId = req.query.school_id as string;
    const courseId = req.query.course_id as string;
    const classId = req.query.class_id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (courseId) where.courseId = courseId;
    if (classId) where.classId = classId;
    if (schoolId) {
      where.course = { schoolId };
    }

    const [assignments, total] = await Promise.all([
      prisma.assignment.findMany({
        where,
        include: {
          course: true,
          class: true,
          teacher: { include: { profile: true } },
          _count: { select: { submissions: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.assignment.count({ where }),
    ]);

    res.json({ data: assignments, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list assignments' });
  }
});

router.get('/teacher', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const teacher = await prisma.teacher.findFirst({ where: { userId } });
    if (!teacher) {
      throw new AppError('Teacher not found', 404);
    }

    const assignments = await prisma.assignment.findMany({
      where: { teacherId: teacher.id },
      include: {
        course: true,
        class: true,
        submissions: {
          include: { student: { include: { profile: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: assignments });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get teacher assignments' });
  }
});

router.get('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        course: true,
        class: true,
        teacher: { include: { profile: true } },
        submissions: {
          include: { student: { include: { profile: true } } },
        },
      },
    });

    if (!assignment) {
      throw new AppError('Assignment not found', 404);
    }

    res.json({ data: assignment });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get assignment' });
  }
});

router.post('/', requireAuth, requireSchoolAccess, validate(createAssignmentSchema), async (req: Request, res: Response) => {
  try {
    const { title, description, course_id, class_id, assignment_type, due_date, max_score, status, attachments } = req.body;

    const teacher = await prisma.teacher.findFirst({ where: { userId: req.user!.userId } });

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description,
        courseId: course_id,
        classId: class_id,
        teacherId: teacher?.id,
        assignmentType: assignment_type,
        dueDate: new Date(due_date),
        maxScore: max_score,
        status,
        attachments,
        createdAt: new Date(),
      },
      include: {
        course: true,
        class: true,
      },
    });

    await logAuditEvent({
      action: 'CREATE',
      entityType: 'Assignment',
      entityId: assignment.id,
      entityName: title,
      userId: req.user!.userId,
    });

    res.status(201).json({ data: assignment });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

router.put('/:id', requireAuth, requireSchoolAccess, validate(updateAssignmentSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, assignment_type, due_date, max_score, status, attachments } = req.body;

    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Assignment not found', 404);
    }

    const assignment = await prisma.assignment.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(assignment_type !== undefined && { assignmentType: assignment_type }),
        ...(due_date !== undefined && { dueDate: new Date(due_date) }),
        ...(max_score !== undefined && { maxScore: max_score }),
        ...(status !== undefined && { status }),
        ...(attachments !== undefined && { attachments }),
      },
      include: {
        course: true,
        class: true,
      },
    });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'Assignment',
      entityId: assignment.id,
      userId: req.user!.userId,
    });

    res.json({ data: assignment });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

router.delete('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Assignment not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.assignmentSubmission.deleteMany({ where: { assignmentId: id } });
      await tx.assignment.delete({ where: { id } });
    });

    await logAuditEvent({
      action: 'DELETE',
      entityType: 'Assignment',
      entityId: id,
      entityName: existing.title,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Assignment deleted successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

export default router;
