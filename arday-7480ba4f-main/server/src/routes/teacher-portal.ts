import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const updateProfileSchema = z.object({
  department: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  full_name: z.string().optional(),
  phone: z.string().optional(),
  avatar_url: z.string().optional(),
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
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
                classStudents: {
                  include: {
                    student: {
                      include: { profile: true, grades: true },
                    },
                  },
                },
              },
            },
          },
        },
        courses: {
          include: {
            grades: true,
            timetableSlots: true,
          },
        },
        timetableSlots: {
          include: {
            class: true,
            course: true,
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
        assignments: {
          include: {
            course: true,
            class: true,
            submissions: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!teacher) {
      throw new AppError('Teacher profile not found', 404);
    }

    const classes = teacher.classTeachers.map((ct) => ct.class);
    const classPerformance = classes.map((cls) => {
      const studentCount = cls.classStudents.length;
      const allGrades = cls.classStudents.flatMap((cs) =>
        cs.student.grades.map((g) => (Number(g.score) / Number(g.maxScore)) * 100)
      );
      const avgPercentage = allGrades.length > 0
        ? allGrades.reduce((a, b) => a + b, 0) / allGrades.length
        : 0;

      return {
        classId: cls.id,
        className: cls.name,
        studentCount,
        averageGrade: Math.round(avgPercentage * 100) / 100,
      };
    });

    res.json({
      data: {
        profile: teacher.profile,
        department: teacher.department,
        subjects: teacher.subjects,
        classes,
        courses: teacher.courses,
        timetable: teacher.timetableSlots,
        assignments: teacher.assignments,
        classPerformance,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get portal data' });
  }
});

router.put('/profile', requireAuth, validate(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { department, subjects, full_name, phone, avatar_url } = req.body;

    const teacher = await prisma.teacher.findFirst({ where: { userId } });
    if (!teacher) {
      throw new AppError('Teacher not found', 404);
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (full_name || phone || avatar_url) {
        await tx.profile.update({
          where: { id: userId },
          data: {
            ...(full_name && { fullName: full_name }),
            ...(phone && { phone }),
            ...(avatar_url && { avatarUrl: avatar_url }),
          },
        });
      }

      return tx.teacher.update({
        where: { id: teacher.id },
        data: {
          ...(department !== undefined && { department }),
          ...(subjects !== undefined && { subjects }),
        },
        include: { profile: true },
      });
    });

    await logAuditEvent({
      action: 'UPDATE_PROFILE',
      entityType: 'Teacher',
      entityId: teacher.id,
      schoolId: teacher.schoolId,
      userId,
    });

    res.json({ data: updated });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
