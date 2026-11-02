import { Router, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess } from '../middleware/schoolAccess.js';
import { requireSuperAdmin } from '../middleware/requireRole.js';
import { AppError } from '../middleware/errorHandler.js';
import { getPlatformAnalytics } from '../services/platformAnalyticsService.js';

const router = Router();

router.get('/platform', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    res.json({ data: await getPlatformAnalytics() });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get platform analytics' });
  }
});

router.get('/school/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) {
      throw new AppError('School not found', 404);
    }

    const [
      totalStudents,
      totalTeachers,
      totalParents,
      totalClasses,
      totalCourses,
      totalAssignments,
      totalInvoices,
      pendingInvoices,
      paidInvoices,
    ] = await Promise.all([
      prisma.student.count({ where: { schoolId: id } }),
      prisma.teacher.count({ where: { schoolId: id } }),
      prisma.parent.count({ where: { schoolId: id } }),
      prisma.class.count({ where: { schoolId: id } }),
      prisma.course.count({ where: { schoolId: id } }),
      prisma.assignment.count({ where: { course: { schoolId: id } } }),
      prisma.invoice.count({ where: { schoolId: id } }),
      prisma.invoice.count({ where: { schoolId: id, status: 'pending' } }),
      prisma.invoice.count({ where: { schoolId: id, status: 'paid' } }),
    ]);

    const revenue = await prisma.invoice.aggregate({
      where: { schoolId: id, status: 'paid' },
      _sum: { amount: true },
    });

    const outstandingAmount = await prisma.invoice.aggregate({
      where: { schoolId: id, status: { in: ['pending', 'overdue'] } },
      _sum: { amount: true },
    });

    res.json({
      data: {
        school,
        totalStudents,
        totalTeachers,
        totalParents,
        totalClasses,
        totalCourses,
        totalAssignments,
        totalInvoices,
        pendingInvoices,
        paidInvoices,
        revenue: revenue._sum.amount ?? 0,
        outstandingAmount: outstandingAmount._sum.amount ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get school analytics' });
  }
});

router.get('/attendance', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const schoolId = req.query.school_id as string;
    const classId = req.query.class_id as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const attendanceWhere: Record<string, unknown> = {};
    if (classId) attendanceWhere.classId = classId;

    if (startDate || endDate) {
      attendanceWhere.date = {};
      if (startDate) (attendanceWhere.date as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (attendanceWhere.date as Record<string, unknown>).lte = new Date(endDate);
    }

    if (schoolId) {
      attendanceWhere.class = { schoolId };
    }

    const records = await prisma.attendance.findMany({
      where: attendanceWhere,
      select: { status: true },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const late = records.filter((r) => r.status === 'late').length;
    const excused = records.filter((r) => r.status === 'excused').length;

    res.json({
      data: {
        total,
        present,
        absent,
        late,
        excused,
        attendanceRate: total > 0 ? Math.round((present / total) * 10000) / 100 : 0,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get attendance analytics' });
  }
});

router.get('/grades', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const schoolId = req.query.school_id as string;
    const courseId = req.query.course_id as string;

    const gradeWhere: Record<string, unknown> = {};
    if (courseId) gradeWhere.courseId = courseId;
    if (schoolId) gradeWhere.course = { schoolId };

    const grades = await prisma.grade.findMany({
      where: gradeWhere,
      select: { score: true, maxScore: true, gradeType: true, courseId: true },
    });

    const total = grades.length;
    const avgScore = total > 0
      ? grades.reduce((sum, g) => sum + Number(g.score) / Number(g.maxScore) * 100, 0) / total
      : 0;

    const byType: Record<string, { count: number; avgPercentage: number }> = {};
    for (const grade of grades) {
      if (!byType[grade.gradeType]) {
        byType[grade.gradeType] = { count: 0, avgPercentage: 0 };
      }
      byType[grade.gradeType].count++;
      byType[grade.gradeType].avgPercentage += (Number(grade.score) / Number(grade.maxScore)) * 100;
    }

    for (const type of Object.keys(byType)) {
      byType[type].avgPercentage = Math.round((byType[type].avgPercentage / byType[type].count) * 100) / 100;
    }

    const gradeDistribution = {
      excellent: grades.filter((g) => (Number(g.score) / Number(g.maxScore)) * 100 >= 90).length,
      good: grades.filter((g) => {
        const pct = (Number(g.score) / Number(g.maxScore)) * 100;
        return pct >= 70 && pct < 90;
      }).length,
      average: grades.filter((g) => {
        const pct = (Number(g.score) / Number(g.maxScore)) * 100;
        return pct >= 50 && pct < 70;
      }).length,
      failing: grades.filter((g) => (Number(g.score) / Number(g.maxScore)) * 100 < 50).length,
    };

    res.json({
      data: {
        total,
        averagePercentage: Math.round(avgScore * 100) / 100,
        byType,
        gradeDistribution,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get grade analytics' });
  }
});

export default router;
