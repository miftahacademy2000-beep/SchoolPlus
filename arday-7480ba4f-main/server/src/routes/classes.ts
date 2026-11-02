import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess, ensureSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const createClassSchema = z.object({
  school_id: z.string().min(1),
  name: z.string().min(1),
  grade: z.string().optional(),
  section: z.string().optional(),
  teacher_id: z.string().optional(),
  capacity: z.number().int().optional(),
  monthly_fee: z.number().min(0).nullable().optional(),
  program: z.string().optional(),
  level_label: z.string().optional(),
  education_level: z.string().optional(),
});

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  grade: z.string().optional(),
  section: z.string().optional(),
  capacity: z.number().int().optional(),
  monthly_fee: z.number().min(0).nullable().optional(),
  program: z.string().optional(),
  level_label: z.string().optional(),
  education_level: z.string().optional(),
});

const assignTeacherSchema = z.object({
  teacher_id: z.string().min(1),
  role: z.string().optional(),
});

const enrollStudentsSchema = z.object({
  student_ids: z.array(z.string().min(1)).min(1),
});

const assignTeachersSchema = z.object({
  teachers: z.array(z.object({
    teacher_id: z.string().min(1),
    role: z.string().optional(),
  })).min(1),
});

router.get('/', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const schoolId = req.query.school_id as string;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { schoolId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { grade: { contains: search } },
      ];
    }

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        include: {
          teacher: { include: { profile: true } },
          class_fees: true,
          _count: { select: { classStudents: true, classTeachers: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.class.count({ where }),
    ]);

    res.json({
      data: classes.map(({ class_fees, ...cls }) => ({
        ...cls,
        monthlyFee: class_fees[0]?.monthly_fee ?? null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list classes' });
  }
});

router.get('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        teacher: { include: { profile: true } },
        classTeachers: { include: { teacher: { include: { profile: true } } } },
        classStudents: { include: { student: { include: { profile: true } } } },
        timetableSlots: { include: { course: true, teacher: { include: { profile: true } } } },
        class_fees: true,
        _count: { select: { classStudents: true } },
      },
    });

    if (!cls) {
      throw new AppError('Class not found', 404);
    }

    const { class_fees, ...classData } = cls;
    res.json({ data: { ...classData, monthlyFee: class_fees[0]?.monthly_fee ?? null } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get class' });
  }
});

router.post('/', requireAuth, requireSchoolAccess, validate(createClassSchema), async (req: Request, res: Response) => {
  try {
    const { school_id, name, grade, section, teacher_id, capacity, monthly_fee, program, level_label, education_level } = req.body;

    const now = new Date();
    const cls = await prisma.$transaction(async (tx) => {
      const createdClass = await tx.class.create({
        data: {
        name,
        schoolId: school_id,
        grade,
        section,
        teacherId: teacher_id,
        capacity,
        program,
        level_label,
        education_level,
          createdAt: now,
        },
        include: { teacher: { include: { profile: true } }, class_fees: true },
      });
      if (monthly_fee !== undefined && monthly_fee !== null && monthly_fee > 0) {
        const school = await tx.school.findUnique({
          where: { id: school_id },
          select: { currency: true },
        });
        if (!school) {
          throw new AppError('School not found', 404);
        }
        await tx.class_fees.create({
          data: {
            class_id: createdClass.id,
            school_id,
            monthly_fee,
            created_at: now,
            updated_at: now,
            currency: school.currency,
          },
        });
      }
      return tx.class.findUniqueOrThrow({
        where: { id: createdClass.id },
        include: { teacher: { include: { profile: true } }, class_fees: true },
      });
    });

    await logAuditEvent({
      action: 'CREATE',
      entityType: 'Class',
      entityId: cls.id,
      entityName: name,
      schoolId: school_id,
      userId: req.user!.userId,
    });

    const { class_fees, ...classData } = cls;
    res.status(201).json({ data: { ...classData, monthlyFee: class_fees[0]?.monthly_fee ?? null } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create class' });
  }
});

router.put('/:id', requireAuth, requireSchoolAccess, validate(updateClassSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new AppError('Class ID is required', 400);
    }
    const { name, grade, section, capacity, monthly_fee, program, level_label, education_level } = req.body;

    const existing = await prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Class not found', 404);
    }

    await ensureSchoolAccess(req, existing.schoolId, ['school_admin', 'super_admin']);

    const cls = await prisma.$transaction(async (tx) => {
      const updatedClass = await tx.class.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(grade !== undefined && { grade }),
          ...(section !== undefined && { section }),
          ...(capacity !== undefined && { capacity }),
          ...(program !== undefined && { program }),
          ...(level_label !== undefined && { level_label }),
          ...(education_level !== undefined && { education_level }),
        },
      });
      if (monthly_fee !== undefined) {
        if (monthly_fee === null || monthly_fee === 0) {
          // Remove the class-specific fee so the school default is used.
          await tx.class_fees.deleteMany({
            where: { class_id: id, school_id: existing.schoolId },
          });
        } else {
          const school = await tx.school.findUnique({
            where: { id: existing.schoolId },
            select: { currency: true },
          });
          if (!school) {
            throw new AppError('School not found', 404);
          }
          const existingFee = await tx.class_fees.findUnique({
            where: {
              class_id_school_id: { class_id: id, school_id: existing.schoolId },
            },
          });
          if (existingFee) {
            await tx.class_fees.update({
              where: {
                class_id_school_id: { class_id: id, school_id: existing.schoolId },
              },
              data: {
                monthly_fee,
                updated_at: new Date(),
              },
            });
          } else {
            await tx.class_fees.create({
              data: {
                class_id: id,
                school_id: existing.schoolId,
                monthly_fee,
                created_at: new Date(),
                updated_at: new Date(),
                currency: school.currency,
              },
            });
          }
        }
      }
      return tx.class.findUniqueOrThrow({
        where: { id },
        include: { teacher: { include: { profile: true } }, class_fees: true },
      });
    });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'Class',
      entityId: cls.id,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    const { class_fees, ...classData } = cls;
    res.json({ data: { ...classData, monthlyFee: class_fees[0]?.monthly_fee ?? null } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update class' });
  }
});

router.delete('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Class not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.classStudent.deleteMany({ where: { classId: id } });
      await tx.classTeacher.deleteMany({ where: { classId: id } });
      await tx.timetableSlot.deleteMany({ where: { classId: id } });
      await tx.attendance.deleteMany({ where: { classId: id } });
      await tx.assignment.deleteMany({ where: { classId: id } });
      await tx.class.delete({ where: { id } });
    });

    await logAuditEvent({
      action: 'DELETE',
      entityType: 'Class',
      entityId: id,
      entityName: existing.name,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Class deleted successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

router.post('/:id/assign-teacher', requireAuth, requireSchoolAccess, validate(assignTeacherSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { teacher_id, role } = req.body;

    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) {
      throw new AppError('Class not found', 404);
    }

    await prisma.class.update({
      where: { id },
      data: { teacherId: teacher_id },
    });

    const classTeacher = await prisma.classTeacher.upsert({
      where: { classId_teacherId: { classId: id, teacherId: teacher_id } },
      create: { classId: id, teacherId: teacher_id, role },
      update: { role },
      include: { teacher: { include: { profile: true } } },
    });

    await logAuditEvent({
      action: 'ASSIGN_TEACHER',
      entityType: 'Class',
      entityId: id,
      schoolId: cls.schoolId,
      userId: req.user!.userId,
      details: { teacherId: teacher_id, role },
    });

    res.json({ data: classTeacher });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to assign teacher' });
  }
});

router.get('/:id/students', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) {
      throw new AppError('Class not found', 404);
    }

    const enrollments = await prisma.classStudent.findMany({
      where: { classId: id },
      include: { student: { include: { profile: true } } },
    });

    res.json({ data: enrollments });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list students' });
  }
});

router.post('/:id/enroll', requireAuth, requireSchoolAccess, validate(enrollStudentsSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { student_ids } = req.body;

    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) {
      throw new AppError('Class not found', 404);
    }

    const enrollments = await prisma.$transaction(async (tx) =>
      Promise.all(
        student_ids.map(async (studentId: string) => {
          const existing = await tx.classStudent.findFirst({
            where: { classId: id, studentId },
          });
          return existing
            ? existing
            : tx.classStudent.create({
                data: { classId: id, studentId, enrolledAt: new Date() },
              });
        }),
      ),
    );

    await logAuditEvent({
      action: 'ENROLL',
      entityType: 'ClassStudent',
      entityId: id,
      schoolId: cls.schoolId,
      userId: req.user!.userId,
      details: { studentIds: student_ids },
    });

    res.status(201).json({ data: enrollments });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to enroll students' });
  }
});

router.delete('/:id/enroll/:studentId', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id, studentId } = req.params;

    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) {
      throw new AppError('Class not found', 404);
    }

    await prisma.classStudent.deleteMany({ where: { classId: id, studentId } });

    await logAuditEvent({
      action: 'UNENROLL',
      entityType: 'ClassStudent',
      entityId: id,
      schoolId: cls.schoolId,
      userId: req.user!.userId,
      details: { studentId },
    });

    res.json({ data: { message: 'Student unenrolled successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to unenroll student' });
  }
});

router.get('/:id/teachers', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) {
      throw new AppError('Class not found', 404);
    }

    const teachers = await prisma.classTeacher.findMany({
      where: { classId: id },
      include: { teacher: { include: { profile: true } } },
    });

    res.json({ data: teachers });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list teachers' });
  }
});

router.post('/:id/teachers', requireAuth, requireSchoolAccess, validate(assignTeachersSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { teachers } = req.body;

    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) {
      throw new AppError('Class not found', 404);
    }

    const assignments = await prisma.$transaction(
      teachers.map((t: { teacher_id: string; role?: string }) =>
        prisma.classTeacher.upsert({
          where: { classId_teacherId: { classId: id, teacherId: t.teacher_id } },
          create: { classId: id, teacherId: t.teacher_id, role: t.role },
          update: { role: t.role },
        })
      )
    );

    await logAuditEvent({
      action: 'ASSIGN_TEACHERS',
      entityType: 'Class',
      entityId: id,
      schoolId: cls.schoolId,
      userId: req.user!.userId,
      details: { teachers },
    });

    res.status(201).json({ data: assignments });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to assign teachers' });
  }
});

router.delete('/:id/teachers/:teacherId', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id, teacherId } = req.params;

    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) {
      throw new AppError('Class not found', 404);
    }

    await prisma.classTeacher.delete({
      where: { classId_teacherId: { classId: id, teacherId } },
    });

    await logAuditEvent({
      action: 'UNASSIGN_TEACHER',
      entityType: 'Class',
      entityId: id,
      schoolId: cls.schoolId,
      userId: req.user!.userId,
      details: { teacherId },
    });

    res.json({ data: { message: 'Teacher unassigned successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to unassign teacher' });
  }
});

export default router;
