import { Router, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const roles = await prisma.userRole.findMany({ where: { userId } });
    const roleTypes = roles.map((r) => r.role);

    const notifications: Array<{ type: string; title: string; message: string; date: Date; data?: unknown }> = [];

    if (roleTypes.includes('student')) {
      const student = await prisma.student.findFirst({
        where: { userId },
        include: {
          grades: { orderBy: { createdAt: 'desc' }, take: 10, include: { course: true } },
          invoices: { orderBy: { createdAt: 'desc' }, take: 10, where: { status: { in: ['pending', 'overdue'] } } },
          attendance: { orderBy: { date: 'desc' }, take: 10 },
        },
      });

      if (student) {
        for (const grade of student.grades) {
          notifications.push({
            type: 'grade',
            title: 'New Grade',
            message: `You received ${grade.score}/${grade.maxScore} for ${grade.title} in ${grade.course.name}`,
            date: grade.createdAt,
            data: { gradeId: grade.id },
          });
        }

        for (const invoice of student.invoices) {
          notifications.push({
            type: 'invoice',
            title: invoice.status === 'overdue' ? 'Overdue Invoice' : 'New Invoice',
            message: `${invoice.title} - ${invoice.amount} (${invoice.status})`,
            date: invoice.createdAt,
            data: { invoiceId: invoice.id },
          });
        }

        const absentRecords = student.attendance.filter((a) => a.status === 'absent');
        for (const att of absentRecords) {
          notifications.push({
            type: 'attendance',
            title: 'Absence Recorded',
            message: `You were marked absent on ${att.date.toISOString().split('T')[0]}`,
            date: att.createdAt,
          });
        }
      }
    }

    if (roleTypes.includes('teacher')) {
      const teacher = await prisma.teacher.findFirst({
        where: { userId },
        include: {
          assignments: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { course: true, submissions: true },
          },
        },
      });

      if (teacher) {
        for (const assignment of teacher.assignments) {
          if (assignment.submissions.length > 0) {
            notifications.push({
              type: 'submission',
              title: 'Assignment Submission',
              message: `${assignment.submissions.length} submission(s) for "${assignment.title}" in ${assignment.course.name}`,
              date: assignment.createdAt,
              data: { assignmentId: assignment.id },
            });
          }
        }
      }
    }

    if (roleTypes.includes('school_admin')) {
      const schoolIds = roles.filter((r) => r.role === 'school_admin').map((r) => r.schoolId).filter(Boolean) as string[];

      const recentInquiries = await prisma.schoolInquiry.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      for (const inquiry of recentInquiries) {
        notifications.push({
          type: 'inquiry',
          title: 'New School Inquiry',
          message: `${inquiry.contactName} - ${inquiry.schoolName}`,
          date: inquiry.createdAt,
          data: { inquiryId: inquiry.id },
        });
      }
    }

    notifications.sort((a, b) => b.date.getTime() - a.date.getTime());

    res.json({ data: notifications });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

router.put('/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const { notification_type, notification_id } = req.body;

    await logAuditEvent({
      action: 'READ_NOTIFICATION',
      entityType: 'Notification',
      userId: req.user!.userId,
      details: { type: notification_type, id: notification_id },
    });

    res.json({ data: { message: 'Notification marked as read' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

router.put('/read-all', requireAuth, async (req: Request, res: Response) => {
  try {
    await logAuditEvent({
      action: 'READ_ALL_NOTIFICATIONS',
      entityType: 'Notification',
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'All notifications marked as read' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

export default router;
