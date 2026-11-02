import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const transferStudentsSchema = z.object({
  student_ids: z.array(z.string().min(1)).min(1),
  from_school_id: z.string().min(1),
  to_school_id: z.string().min(1),
});

router.post('/students', requireAuth, requireSchoolAccess, validate(transferStudentsSchema), async (req: Request, res: Response) => {
  try {
    const { student_ids, from_school_id, to_school_id } = req.body;

    if (from_school_id === to_school_id) {
      throw new AppError('Source and destination schools must be different', 400);
    }

    const fromSchool = await prisma.school.findUnique({ where: { id: from_school_id } });
    if (!fromSchool) {
      throw new AppError('Source school not found', 404);
    }

    const toSchool = await prisma.school.findUnique({ where: { id: to_school_id } });
    if (!toSchool) {
      throw new AppError('Destination school not found', 404);
    }

    const students = await prisma.student.findMany({
      where: {
        id: { in: student_ids },
        schoolId: from_school_id,
      },
    });

    if (students.length !== student_ids.length) {
      throw new AppError('Some students were not found in the source school', 400);
    }

    const results = await prisma.$transaction(async (tx) => {
      const transferred = [];

      for (const studentId of student_ids) {
        const student = students.find((s) => s.id === studentId)!;

        const newStudent = await tx.student.update({
          where: { id: studentId },
          data: {
            schoolId: to_school_id,
          },
        });

        await tx.classStudent.deleteMany({ where: { studentId } });

        await logAuditEvent({
          action: 'TRANSFER',
          entityType: 'Student',
          entityId: studentId,
          schoolId: to_school_id,
          userId: req.user!.userId,
          details: {
            fromSchoolId: from_school_id,
            toSchoolId: to_school_id,
            studentUserId: student.userId,
          },
        });

        transferred.push(newStudent);
      }

      return transferred;
    });

    await logAuditEvent({
      action: 'BATCH_TRANSFER',
      entityType: 'Student',
      schoolId: from_school_id,
      userId: req.user!.userId,
      details: {
        fromSchoolId: from_school_id,
        toSchoolId: to_school_id,
        count: results.length,
        studentIds: student_ids,
      },
    });

    res.json({
      data: {
        transferred: results.length,
        students: results,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to transfer students' });
  }
});

export default router;
