import { Router, Request, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';
import { uploadLearningMaterials } from '../middleware/upload.js';

const router = Router();

const createMaterialSchema = z.object({
  course_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

const updateMaterialSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
});

router.get('/', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const courseId = req.query.course_id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (courseId) where.courseId = courseId;

    const [materials, total] = await Promise.all([
      prisma.learningMaterial.findMany({
        where,
        include: {
          course: true,
          teacher: { include: { profile: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.learningMaterial.count({ where }),
    ]);

    res.json({ data: materials, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list materials' });
  }
});

router.post('/', requireAuth, requireSchoolAccess, (req: Request, res: Response) => {
  uploadLearningMaterials.single('file')(req, res, async (err) => {
    try {
      if (err) {
        throw new AppError(err.message, 400);
      }

      const userId = req.user!.userId;
      const teacher = await prisma.teacher.findFirst({ where: { userId } });
      if (!teacher) {
        throw new AppError('Teacher not found', 404);
      }

      const { course_id, title, description } = req.body;

      const parsed = createMaterialSchema.parse({ course_id, title, description });

      const file = req.file;
      if (!file) {
        throw new AppError('File is required', 400);
      }

      const material = await prisma.learningMaterial.create({
        data: {
          courseId: parsed.course_id,
          teacherId: teacher.id,
          title: parsed.title,
          description: parsed.description ?? '',
          fileUrl: `/uploads/learning-materials/${file.filename}`,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          createdAt: new Date(),
        },
        include: {
          course: true,
          teacher: { include: { profile: true } },
        },
      });

      await logAuditEvent({
        action: 'CREATE',
        entityType: 'LearningMaterial',
        entityId: material.id,
        entityName: parsed.title,
        userId,
      });

      res.status(201).json({ data: material });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Failed to upload material' });
    }
  });
});

router.put('/:id', requireAuth, requireSchoolAccess, validate(updateMaterialSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const existing = await prisma.learningMaterial.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Material not found', 404);
    }

    const material = await prisma.learningMaterial.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
      },
      include: {
        course: true,
        teacher: { include: { profile: true } },
      },
    });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'LearningMaterial',
      entityId: material.id,
      userId: req.user!.userId,
    });

    res.json({ data: material });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update material' });
  }
});

router.delete('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.learningMaterial.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Material not found', 404);
    }

    const filePath = path.join(process.cwd(), 'uploads', 'learning-materials', path.basename(existing.fileUrl));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.learningMaterial.delete({ where: { id } });

    await logAuditEvent({
      action: 'DELETE',
      entityType: 'LearningMaterial',
      entityId: id,
      entityName: existing.title,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Material deleted successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

router.get('/:id/download', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const material = await prisma.learningMaterial.findUnique({ where: { id } });
    if (!material) {
      throw new AppError('Material not found', 404);
    }

    const filePath = path.join(process.cwd(), 'uploads', 'learning-materials', path.basename(material.fileUrl));
    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found on disk', 404);
    }

    res.download(filePath, material.fileName);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to download material' });
  }
});

export default router;
