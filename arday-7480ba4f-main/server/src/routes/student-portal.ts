import { Router, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

async function getAuthenticatedStudent(userId: string) {
  const student = await prisma.student.findFirst({
    where: { userId, archived_at: null },
    include: {
      profile: {
        select: { id: true, fullName: true, email: true, loginId: true, avatarUrl: true, phone: true },
      },
      schools: { select: { id: true, name: true, logoUrl: true } },
      classStudents: {
        include: {
          class: {
            include: {
              teacher: { include: { profile: { select: { fullName: true } } } },
              classTeachers: { include: { teacher: { include: { profile: { select: { fullName: true } } } } } },
            },
          },
        },
      },
    },
  });

  if (!student) {
    throw new AppError('Student profile not found', 404);
  }

  const studentRole = await prisma.userRole.findFirst({
    where: { userId, role: 'student', schoolId: student.schoolId },
  });
  if (!studentRole) {
    throw new AppError('Student portal access is not enabled for this account', 403);
  }

  return student;
}

function toPortalProfile(student: Awaited<ReturnType<typeof getAuthenticatedStudent>>) {
  return {
    id: student.id,
    user_id: student.userId,
    school_id: student.schoolId,
    enrollment_number: student.enrollmentNumber,
    grade: student.grade,
    date_of_birth: student.dateOfBirth,
    created_at: student.createdAt,
    profile: student.profile ? {
      id: student.profile.id,
      full_name: student.profile.fullName,
      email: student.profile.email,
      login_id: student.profile.loginId,
      avatar_url: student.profile.avatarUrl,
      phone: student.profile.phone,
    } : null,
    school: {
      id: student.schools.id,
      name: student.schools.name,
      logo_url: student.schools.logoUrl,
    },
  };
}

function handleError(res: Response, error: unknown, message: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error(message, error);
  res.status(500).json({ error: message });
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req.user!.userId);
    res.json({ data: toPortalProfile(student) });
  } catch (error) {
    handleError(res, error, 'Failed to get student portal profile');
  }
});

router.get('/classes', requireAuth, async (req: Request, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req.user!.userId);
    res.json({
      data: student.classStudents
        .filter(({ class: studentClass }) => studentClass.schoolId === student.schoolId)
        .map(({ class: studentClass, enrolledAt }) => ({
        id: studentClass.id,
        class_id: studentClass.id,
        enrolled_at: enrolledAt,
        class: {
          id: studentClass.id,
          name: studentClass.name,
          grade: studentClass.grade,
          section: studentClass.section,
          teacher: studentClass.teacher ? {
            id: studentClass.teacher.id,
            profile: { full_name: studentClass.teacher.profile.fullName },
          } : null,
        },
      })),
    });
  } catch (error) {
    handleError(res, error, 'Failed to get student classes');
  }
});

router.get('/courses', requireAuth, async (req: Request, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req.user!.userId);
    const classIds = student.classStudents
      .filter(({ class: studentClass }) => studentClass.schoolId === student.schoolId)
      .map(({ classId }) => classId);
    const slots = classIds.length
      ? await prisma.timetableSlot.findMany({
          where: { classId: { in: classIds }, course: { schoolId: student.schoolId } },
          include: {
            course: {
              include: {
                teacher: { include: { profile: { select: { fullName: true } } } },
              },
            },
          },
        })
      : [];
    const courses = new Map();
    for (const slot of slots) {
      if (slot.course) {
        courses.set(slot.course.id, {
          id: slot.course.id,
          name: slot.course.name,
          code: slot.course.code,
          description: slot.course.description,
          credits: slot.course.credits,
          teacher: slot.course.teacher ? {
            id: slot.course.teacher.id,
            profile: { full_name: slot.course.teacher.profile.fullName },
          } : null,
        });
      }
    }
    res.json({ data: [...courses.values()] });
  } catch (error) {
    handleError(res, error, 'Failed to get student courses');
  }
});

router.get('/grades', requireAuth, async (req: Request, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req.user!.userId);
    const grades = await prisma.grade.findMany({
      where: { studentId: student.id, course: { schoolId: student.schoolId } },
      include: { course: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      data: grades.map((grade) => ({
        id: grade.id,
        title: grade.title,
        score: grade.score,
        max_score: grade.maxScore,
        grade_type: grade.gradeType,
        graded_at: grade.gradedAt,
        notes: grade.notes,
        course: grade.course,
      })),
    });
  } catch (error) {
    handleError(res, error, 'Failed to get student grades');
  }
});

router.get('/exams', requireAuth, async (req: Request, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req.user!.userId);
    const exams = await prisma.exams.findMany({
      where: { student_id: student.id, school_id: student.schoolId },
      include: {
        classes: { select: { id: true, name: true } },
        subjects: { select: { id: true, name: true } },
        terms: { select: { id: true, name: true } },
        exam_types: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json({ data: exams });
  } catch (error) {
    handleError(res, error, 'Failed to get student exams');
  }
});

router.get('/attendance', requireAuth, async (req: Request, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req.user!.userId);
    const records = await prisma.attendance.findMany({
      where: { studentId: student.id, class: { schoolId: student.schoolId } },
      include: { class: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
      take: 30,
    });
    res.json({
      data: records.map((record) => ({
        id: record.id,
        date: record.date,
        status: record.status,
        notes: record.notes,
        class: record.class,
      })),
    });
  } catch (error) {
    handleError(res, error, 'Failed to get student attendance');
  }
});

router.get('/timetable', requireAuth, async (req: Request, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req.user!.userId);
    const classIds = student.classStudents
      .filter(({ class: studentClass }) => studentClass.schoolId === student.schoolId)
      .map(({ classId }) => classId);
    const slots = classIds.length
      ? await prisma.timetableSlot.findMany({
          where: { classId: { in: classIds }, class: { schoolId: student.schoolId } },
          include: {
            course: { select: { id: true, name: true, code: true } },
            teacher: { include: { profile: { select: { fullName: true } } } },
            class: { select: { id: true, name: true } },
          },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        })
      : [];
    res.json({
      data: slots.map((slot) => ({
        id: slot.id,
        day_of_week: slot.dayOfWeek,
        start_time: slot.startTime?.toISOString().slice(11, 19) ?? '',
        end_time: slot.endTime?.toISOString().slice(11, 19) ?? '',
        room: slot.room,
        course: slot.course,
        teacher: slot.teacher ? {
          id: slot.teacher.id,
          profile: { full_name: slot.teacher.profile.fullName },
        } : null,
        class: slot.class,
      })),
    });
  } catch (error) {
    handleError(res, error, 'Failed to get student timetable');
  }
});

router.get('/invoices', requireAuth, async (req: Request, res: Response) => {
  try {
    const student = await getAuthenticatedStudent(req.user!.userId);
    const invoices = await prisma.invoice.findMany({
      where: { studentId: student.id, schoolId: student.schoolId },
      include: {
        paymentHistory: {
          select: { id: true, amount: true, paymentMethod: true, notes: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      total: invoices.length,
      pending: invoices.filter((invoice) => invoice.status === 'pending').length,
      paid: invoices.filter((invoice) => invoice.status === 'paid').length,
      overdue: invoices.filter((invoice) => invoice.status === 'overdue').length,
      totalAmount: invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0),
      totalPaid: invoices.reduce((sum, invoice) => sum + Number(invoice.amountPaid), 0),
      totalOutstanding: invoices
        .filter((invoice) => invoice.status !== 'paid')
        .reduce((sum, invoice) => sum + Number(invoice.amount) - Number(invoice.amountPaid), 0),
    };
    res.json({ data: { invoices, summary } });
  } catch (error) {
    handleError(res, error, 'Failed to get student invoices');
  }
});

export default router;
