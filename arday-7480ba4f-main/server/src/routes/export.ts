import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';

const router = Router();

interface ExportClassEnrollment {
  classId: string;
  enrolledAt: Date;
  class: {
    name: string;
    grade: string | null;
    section: string | null;
    class_fees: { monthly_fee: unknown; currency: string }[];
  };
}

interface ExportStudentFeeOverride {
  monthlyFee: unknown;
  currency: string;
}

interface ExportInvoiceBalance {
  amount: unknown;
  amountPaid: unknown;
  status: string;
  currency: string;
}

const exportStudentDataSchema = z.object({
  school_id: z.string().min(1),
  student_ids: z.array(z.string()).optional(),
  include_attendance: z.boolean().default(true),
  include_grades: z.boolean().default(true),
  include_enrollments: z.boolean().default(true),
  include_courses: z.boolean().default(true),
});

router.post('/student-data', requireAuth, requireSchoolAccess, validate(exportStudentDataSchema), async (req: Request, res: Response) => {
  try {
    const { school_id, student_ids, include_attendance, include_grades, include_enrollments, include_courses } = req.body;

    const studentWhere: Record<string, unknown> = { schoolId: school_id };
    if (student_ids && student_ids.length > 0) {
      studentWhere.id = { in: student_ids };
    }

    const school = await prisma.school.findUnique({
      where: { id: school_id },
      select: { monthlyFee: true, currency: true },
    });

    const students = await prisma.student.findMany({
      where: studentWhere,
      include: {
        profile: true,
        classStudents: {
          where: { class: { schoolId: school_id } },
          include: {
            class: {
              include: {
                class_fees: { where: { school_id }, select: { monthly_fee: true, currency: true } },
              },
            },
          },
        },
        studentFeeOverrides: { where: { schoolId: school_id }, select: { monthlyFee: true, currency: true } },
        invoices: { where: { schoolId: school_id }, select: { amount: true, amountPaid: true, status: true, currency: true } },
      },
    });

    const exportData: Record<string, unknown>[] = [];

    for (const student of students) {
      const classStudents = student.classStudents as ExportClassEnrollment[];
      const studentFeeOverrides = student.studentFeeOverrides as ExportStudentFeeOverride[];
      const invoices = student.invoices as ExportInvoiceBalance[];
      const entry: Record<string, unknown> = {
        id: student.id,
        enrollmentNumber: student.enrollmentNumber,
        fullName: student.profile?.fullName,
        email: student.profile?.email,
        phone: student.profile?.phone,
        dateOfBirth: student.dateOfBirth,
        grade: student.grade,
        createdAt: student.createdAt,
        startDate: student.start_date || classStudents
          .map((enrollment) => enrollment.enrolledAt)
          .sort((a, b) => a.getTime() - b.getTime())[0] || student.createdAt,
        className: classStudents
          .map((enrollment) => enrollment.class.name)
          .sort((a, b) => a.localeCompare(b))
          .join(', '),
        status: 'Active',
        monthlyFee: (() => {
          const studentOverride = studentFeeOverrides[0];
          const classFees = classStudents.flatMap((enrollment) => enrollment.class.class_fees);
          const classFee = classFees.sort((a, b) => Number(b.monthly_fee) - Number(a.monthly_fee))[0];
          const amount = studentOverride?.monthlyFee ?? classFee?.monthly_fee ?? school?.monthlyFee ?? 0;
          const currency = studentOverride?.currency ?? classFee?.currency ?? school?.currency ?? 'USD';
          return `${Number(amount).toFixed(2)} ${currency}`;
        })(),
        balance: (() => {
          const balances = new Map<string, number>();
          for (const invoice of invoices) {
            if (invoice.status === 'cancelled' || invoice.status === 'paid') continue;
            const remaining = Math.max(0, Number(invoice.amount) - Number(invoice.amountPaid));
            if (remaining > 0) balances.set(invoice.currency, (balances.get(invoice.currency) || 0) + remaining);
          }
          return [...balances.entries()].map(([currency, amount]) => `${amount.toFixed(2)} ${currency}`).join(' · ') || `0.00 ${school?.currency ?? 'USD'}`;
        })(),
      };

      if (include_enrollments) {
        entry.enrollments = classStudents.map((cs) => ({
          className: cs.class.name,
          classGrade: cs.class.grade,
          classSection: cs.class.section,
          enrolledAt: cs.enrolledAt,
        }));
      }

      if (include_attendance) {
        const attendance = await prisma.attendance.findMany({
          where: { studentId: student.id, class: { schoolId: school_id } },
          select: { date: true, status: true, notes: true, class: { select: { name: true } } },
          orderBy: { date: 'asc' },
        });
        entry.attendance = attendance.map((a: { date: Date; status: string; notes: string | null; class: { name: string } }) => ({
          date: a.date,
          status: a.status,
          className: a.class.name,
          notes: a.notes,
        }));
      }

      if (include_grades) {
        const grades = await prisma.grade.findMany({
          where: { studentId: student.id, course: { schoolId: school_id } },
          include: { course: { select: { name: true, code: true } } },
          orderBy: { createdAt: 'desc' },
        });
        entry.grades = grades.map((g: { course: { name: string; code: string }; gradeType: string; title: string; score: number; maxScore: number; gradedAt: Date }) => ({
          courseName: g.course.name,
          courseCode: g.course.code,
          gradeType: g.gradeType,
          title: g.title,
          score: g.score,
          maxScore: g.maxScore,
          percentage: Math.round((Number(g.score) / Number(g.maxScore)) * 10000) / 100,
          gradedAt: g.gradedAt,
        }));
      }

      if (include_courses) {
        const courseIds = classStudents.flatMap((cs) =>
          prisma.timetableSlot.findMany({
            where: { classId: cs.classId, class: { schoolId: school_id }, course: { schoolId: school_id } },
            select: { courseId: true },
          })
        );
        const resolvedCourseIds = (await Promise.all(courseIds))
          .flat()
          .map((s: { courseId: string | null }) => s.courseId)
          .filter(Boolean) as string[];

        if (resolvedCourseIds.length > 0) {
          const courses = await prisma.course.findMany({
            where: { schoolId: school_id, id: { in: [...new Set(resolvedCourseIds)] } },
            select: { id: true, name: true, code: true },
          });
          entry.courses = courses;
        } else {
          entry.courses = [];
        }
      }

      exportData.push(entry);
    }

    res.json({
      data: {
        exportedAt: new Date().toISOString(),
        schoolId: school_id,
        totalStudents: exportData.length,
        students: exportData,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to export student data' });
  }
});

export default router;
