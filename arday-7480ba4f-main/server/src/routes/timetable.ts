import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const createSlotSchema = z.object({
  class_id: z.string().min(1),
  course_id: z.string().optional(),
  teacher_id: z.string().optional(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  room: z.string().optional(),
});

const updateSlotSchema = z.object({
  course_id: z.string().optional(),
  teacher_id: z.string().optional(),
  day_of_week: z.number().int().min(0).max(6).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  room: z.string().optional(),
});

router.get('/', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const classId = req.query.class_id as string;
    const teacherId = req.query.teacher_id as string;

    const where: Record<string, unknown> = {};
    if (classId) where.classId = classId;
    if (teacherId) where.teacherId = teacherId;

    const slots = await prisma.timetableSlot.findMany({
      where,
      include: {
        class: true,
        course: true,
        teacher: { include: { profile: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    res.json({ data: slots });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get timetable' });
  }
});

router.post('/', requireAuth, requireSchoolAccess, validate(createSlotSchema), async (req: Request, res: Response) => {
  try {
    const { class_id, course_id, teacher_id, day_of_week, start_time, end_time, room } = req.body;

    const cls = await prisma.class.findUnique({ where: { id: class_id } });
    if (!cls) {
      throw new AppError('Class not found', 404);
    }

    const slot = await prisma.timetableSlot.create({
      data: {
        classId: class_id,
        courseId: course_id,
        teacherId: teacher_id,
        dayOfWeek: day_of_week,
        startTime: start_time,
        endTime: end_time,
        room,
      },
      include: {
        class: true,
        course: true,
        teacher: { include: { profile: true } },
      },
    });

    await logAuditEvent({
      action: 'CREATE',
      entityType: 'TimetableSlot',
      entityId: slot.id,
      schoolId: cls.schoolId,
      userId: req.user!.userId,
    });

    res.status(201).json({ data: slot });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create slot' });
  }
});

router.put('/:id', requireAuth, requireSchoolAccess, validate(updateSlotSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { course_id, teacher_id, day_of_week, start_time, end_time, room } = req.body;

    const existing = await prisma.timetableSlot.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Slot not found', 404);
    }

    const slot = await prisma.timetableSlot.update({
      where: { id },
      data: {
        ...(course_id !== undefined && { courseId: course_id }),
        ...(teacher_id !== undefined && { teacherId: teacher_id }),
        ...(day_of_week !== undefined && { dayOfWeek: day_of_week }),
        ...(start_time !== undefined && { startTime: start_time }),
        ...(end_time !== undefined && { endTime: end_time }),
        ...(room !== undefined && { room }),
      },
      include: {
        class: true,
        course: true,
        teacher: { include: { profile: true } },
      },
    });

    const cls = await prisma.class.findUnique({ where: { id: existing.classId } });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'TimetableSlot',
      entityId: slot.id,
      schoolId: cls?.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: slot });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update slot' });
  }
});

router.delete('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.timetableSlot.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Slot not found', 404);
    }

    await prisma.timetableSlot.delete({ where: { id } });

    const cls = await prisma.class.findUnique({ where: { id: existing.classId } });

    await logAuditEvent({
      action: 'DELETE',
      entityType: 'TimetableSlot',
      entityId: id,
      schoolId: cls?.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Slot deleted successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete slot' });
  }
});

export default router;
