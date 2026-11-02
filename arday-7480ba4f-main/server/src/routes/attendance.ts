import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const markAttendanceSchema = z.object({
  student_id: z.string().min(1),
  class_id: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  notes: z.string().optional(),
});

const bulkAttendanceSchema = z.object({
  class_id: z.string().min(1),
  date: z.string().min(1),
  records: z.array(z.object({
    student_id: z.string().min(1),
    status: z.enum(['present', 'absent', 'late', 'excused']),
    notes: z.string().optional(),
  })).min(1),
});

router.get('/', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const classId = req.query.class_id as string;
    const date = req.query.date as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const where: Record<string, unknown> = {};
    if (classId) where.classId = classId;
    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = { gte: d, lt: nextDay };
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          student: { include: { profile: true } },
          class: true,
          marker: true,
        },
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      prisma.attendance.count({ where }),
    ]);

    res.json({ data: records, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get attendance' });
  }
});

router.get('/range', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const classId = req.query.class_id as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    if (!startDate || !endDate) {
      throw new AppError('start_date and end_date are required', 400);
    }

    const where: Record<string, unknown> = {
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    };
    if (classId) where.classId = classId;

    const records = await prisma.attendance.findMany({
      where,
      include: {
        student: { include: { profile: true } },
        class: true,
      },
      orderBy: [{ date: 'asc' }, { studentId: 'asc' }],
    });

    res.json({ data: records });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get attendance range' });
  }
});

router.get('/analytics', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const schoolId = req.query.school_id as string;
    const classId = req.query.class_id as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const classWhere: Record<string, unknown> = {};
    if (classId) classWhere.classId = classId;

    const attendanceWhere: Record<string, unknown> = {};
    if (classId) attendanceWhere.classId = classId;
    if (startDate || endDate) {
      attendanceWhere.date = {};
      if (startDate) (attendanceWhere.date as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (attendanceWhere.date as Record<string, unknown>).lte = new Date(endDate);
    }

    const allRecords = await prisma.attendance.findMany({
      where: attendanceWhere,
      select: { status: true, date: true },
    });

    const totalRecords = allRecords.length;
    const presentCount = allRecords.filter((r) => r.status === 'present').length;
    const absentCount = allRecords.filter((r) => r.status === 'absent').length;
    const lateCount = allRecords.filter((r) => r.status === 'late').length;
    const excusedCount = allRecords.filter((r) => r.status === 'excused').length;
    const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;

    const byDate: Record<string, { present: number; absent: number; late: number; excused: number }> = {};
    for (const record of allRecords) {
      const dateKey = record.date.toISOString().split('T')[0];
      if (!byDate[dateKey]) {
        byDate[dateKey] = { present: 0, absent: 0, late: 0, excused: 0 };
      }
      if (record.status in byDate[dateKey]) {
        (byDate[dateKey] as Record<string, number>)[record.status]++;
      }
    }

    res.json({
      data: {
        totalRecords,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        byDate,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

router.post('/', requireAuth, requireSchoolAccess, validate(markAttendanceSchema), async (req: Request, res: Response) => {
  try {
    const { student_id, class_id, date, status, notes } = req.body;

    const attendanceDate = new Date(date);
    const existing = await prisma.attendance.findFirst({
      where: { studentId: student_id, classId: class_id, date: attendanceDate },
    });
    const record = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: { status, notes, markedBy: req.user!.userId },
          include: {
            student: { include: { profile: true } },
            class: true,
          },
        })
      : await prisma.attendance.create({
          data: {
        studentId: student_id,
        classId: class_id,
        date: attendanceDate,
        status,
        notes,
        markedBy: req.user!.userId,
            createdAt: new Date(),
          },
          include: {
            student: { include: { profile: true } },
            class: true,
          },
        });

    await logAuditEvent({
      action: 'MARK_ATTENDANCE',
      entityType: 'Attendance',
      entityId: record.id,
      schoolId: class_id,
      userId: req.user!.userId,
      details: { studentId: student_id, classId: class_id, date, status },
    });

    res.status(201).json({ data: record });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

router.post('/bulk', requireAuth, requireSchoolAccess, validate(bulkAttendanceSchema), async (req: Request, res: Response) => {
  try {
    const { class_id, date, records } = req.body;

    const attendanceDate = new Date(date);
    const results = await prisma.$transaction(async (tx) =>
      Promise.all(
        records.map(async (r: { student_id: string; status: string; notes?: string }) => {
          const existing = await tx.attendance.findFirst({
            where: { studentId: r.student_id, classId: class_id, date: attendanceDate },
          });
          return existing
            ? tx.attendance.update({
                where: { id: existing.id },
                data: { status: r.status, notes: r.notes, markedBy: req.user!.userId },
              })
            : tx.attendance.create({
                data: {
                  studentId: r.student_id,
                  classId: class_id,
                  date: attendanceDate,
                  status: r.status,
                  notes: r.notes,
                  markedBy: req.user!.userId,
                  createdAt: new Date(),
                },
              });
        }),
      ),
    );

    await logAuditEvent({
      action: 'BULK_MARK_ATTENDANCE',
      entityType: 'Attendance',
      schoolId: class_id,
      userId: req.user!.userId,
      details: { classId: class_id, date, count: results.length },
    });

    res.status(201).json({ data: results });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to bulk mark attendance' });
  }
});

router.delete('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const record = await prisma.attendance.findUnique({ where: { id } });
    if (!record) {
      throw new AppError('Attendance record not found', 404);
    }

    await prisma.attendance.delete({ where: { id } });

    await logAuditEvent({
      action: 'DELETE',
      entityType: 'Attendance',
      entityId: id,
      schoolId: record.classId,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Attendance record deleted' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete attendance' });
  }
});

export default router;
