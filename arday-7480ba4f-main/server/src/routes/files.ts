import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAuditEvent } from '../utils/auditLog.js';
import { uploadSchoolAssets, uploadAvatars, uploadLearningMaterials, uploadPlatformAssets } from '../middleware/upload.js';
import { env } from '../config/env.js';

const router = Router();

const uploaders: Record<string, typeof uploadSchoolAssets> = {
  'school-assets': uploadSchoolAssets,
  'avatars': uploadAvatars,
  'learning-materials': uploadLearningMaterials,
  'platform-assets': uploadPlatformAssets,
};

router.post('/upload/:type', requireAuth, async (req: Request, res: Response) => {
  const { type } = req.params;
  const uploader = uploaders[type];

  if (!uploader) {
    res.status(400).json({ error: 'Invalid upload type. Use: school-assets, avatars, learning-materials, or platform-assets' });
    return;
  }

  // Super-admin-only for platform assets
  if (type === 'platform-assets') {
    const roles = await prisma.userRole.findMany({ where: { userId: req.user!.userId } });
    const isSuperAdmin = roles.some((r) => r.role === 'super_admin');
    if (!isSuperAdmin) {
      res.status(403).json({ error: 'Only super admins can upload platform assets' });
      return;
    }
  }

  uploader.single('file')(req, res, async (err) => {
    try {
      if (err) {
        throw new AppError(err.message, 400);
      }

      const file = req.file;
      if (!file) {
        throw new AppError('No file provided', 400);
      }

      await logAuditEvent({
        action: 'UPLOAD',
        entityType: 'File',
        userId: req.user!.userId,
        details: {
          type,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
        },
      });

      const publicUrl = `${env.apiUrl.replace(/\/$/, '')}/uploads/${type}/${file.filename}`;

      res.status(201).json({
        data: {
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: publicUrl,
          path: `/uploads/${type}/${file.filename}`,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });
});

router.get('/download/:type/:filename', requireAuth, (req: Request, res: Response) => {
  try {
    const { type, filename } = req.params;

    if (!['school-assets', 'avatars', 'learning-materials'].includes(type)) {
      throw new AppError('Invalid file type', 400);
    }

    const filePath = path.join(process.cwd(), 'uploads', type, filename);
    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404);
    }

    res.download(filePath, filename);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to download file' });
  }
});

router.delete('/:type/:filename', requireAuth, (req: Request, res: Response) => {
  try {
    const { type, filename } = req.params;

    if (!['school-assets', 'avatars', 'learning-materials'].includes(type)) {
      throw new AppError('Invalid file type', 400);
    }

    const filePath = path.join(process.cwd(), 'uploads', type, filename);
    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404);
    }

    fs.unlinkSync(filePath);

    logAuditEvent({
      action: 'DELETE',
      entityType: 'File',
      userId: req.user!.userId,
      details: { type, filename },
    });

    res.json({ data: { message: 'File deleted successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;
