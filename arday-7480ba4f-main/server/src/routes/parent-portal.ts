import { Router, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/children', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const parent = await prisma.parent.findFirst({
      where: { userId },
      include: { profile: true },
    });

    if (!parent) {
      throw new AppError('Parent profile not found', 404);
    }

    const links = await prisma.parentStudent.findMany({
      where: { parentId: parent.id, student: { schoolId: parent.schoolId } },
      include: {
        student: {
          include: {
            profile: true,
            classStudents: {
              include: {
                class: {
                  include: {
                    teacher: { include: { profile: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const children = links.map((link) => link.student);

    res.json({
      data: {
        parent: parent.profile,
        children,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get children' });
  }
});

router.get('/children/:studentId/classes', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { studentId } = req.params;

    const parent = await prisma.parent.findFirst({ where: { userId } });
    if (!parent) {
      throw new AppError('Parent not found', 404);
    }

    const link = await prisma.parentStudent.findFirst({
      where: { parentId: parent.id, studentId, student: { schoolId: parent.schoolId } },
    });
    if (!link) {
      throw new AppError('Not authorized to access this student', 403);
    }

    const classes = await prisma.classStudent.findMany({
      where: { studentId },
      include: {
        class: {
          include: {
            teacher: { include: { profile: true } },
            classTeachers: { include: { teacher: { include: { profile: true } } } },
          },
        },
      },
    });

    res.json({ data: classes.map((cs) => cs.class) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get classes' });
  }
});

router.get('/children/:studentId/grades', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { studentId } = req.params;

    const parent = await prisma.parent.findFirst({ where: { userId } });
    if (!parent) {
      throw new AppError('Parent not found', 404);
    }

    const link = await prisma.parentStudent.findFirst({
      where: { parentId: parent.id, studentId, student: { schoolId: parent.schoolId } },
    });
    if (!link) {
      throw new AppError('Not authorized to access this student', 403);
    }

    const grades = await prisma.grade.findMany({
      where: { studentId },
      include: { course: true },
      orderBy: { createdAt: 'desc' },
    });

    const summary: Record<string, { avg: number; count: number }> = {};
    for (const grade of grades) {
      const courseName = grade.course.name;
      if (!summary[courseName]) {
        summary[courseName] = { avg: 0, count: 0 };
      }
      summary[courseName].avg += (Number(grade.score) / Number(grade.maxScore)) * 100;
      summary[courseName].count++;
    }

    for (const key of Object.keys(summary)) {
      summary[key].avg = Math.round((summary[key].avg / summary[key].count) * 100) / 100;
    }

    res.json({ data: { grades, summary } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get grades' });
  }
});

router.get('/children/:studentId/attendance', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { studentId } = req.params;

    const parent = await prisma.parent.findFirst({ where: { userId } });
    if (!parent) {
      throw new AppError('Parent not found', 404);
    }

    const link = await prisma.parentStudent.findFirst({
      where: { parentId: parent.id, studentId, student: { schoolId: parent.schoolId } },
    });
    if (!link) {
      throw new AppError('Not authorized to access this student', 403);
    }

    const attendance = await prisma.attendance.findMany({
      where: { studentId },
      include: { class: true },
      orderBy: { date: 'desc' },
      take: 60,
    });

    const total = attendance.length;
    const present = attendance.filter((a) => a.status === 'present').length;
    const absent = attendance.filter((a) => a.status === 'absent').length;
    const late = attendance.filter((a) => a.status === 'late').length;

    res.json({
      data: {
        records: attendance,
        summary: {
          total,
          present,
          absent,
          late,
          rate: total > 0 ? Math.round((present / total) * 10000) / 100 : 0,
        },
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get attendance' });
  }
});

router.get('/children/:studentId/timetable', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { studentId } = req.params;

    const parent = await prisma.parent.findFirst({ where: { userId } });
    if (!parent) {
      throw new AppError('Parent not found', 404);
    }

    const link = await prisma.parentStudent.findFirst({
      where: { parentId: parent.id, studentId, student: { schoolId: parent.schoolId } },
    });
    if (!link) {
      throw new AppError('Not authorized to access this student', 403);
    }

    const classIds = await prisma.classStudent.findMany({
      where: { studentId },
      select: { classId: true },
    });

    const timetable = await prisma.timetableSlot.findMany({
      where: {
        classId: { in: classIds.map((c) => c.classId) },
      },
      include: {
        course: true,
        teacher: { include: { profile: true } },
        class: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    res.json({ data: timetable });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get timetable' });
  }
});

router.get('/children/:studentId/invoices', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { studentId } = req.params;

    const parent = await prisma.parent.findFirst({ where: { userId } });
    if (!parent) {
      throw new AppError('Parent not found', 404);
    }

    const link = await prisma.parentStudent.findFirst({
      where: { parentId: parent.id, studentId, student: { schoolId: parent.schoolId } },
    });
    if (!link) {
      throw new AppError('Not authorized to access this student', 403);
    }

    const invoices = await prisma.invoice.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: invoices });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

export default router;
