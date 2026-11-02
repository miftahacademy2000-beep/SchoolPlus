import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAuditEvent } from '../utils/auditLog.js';

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const profile = await prisma.profile.findUnique({
      where: { id: req.user.userId },
      include: {
        teachers: {
          select: {
            id: true,
            employeeId: true,
            department: true,
            subjects: true,
            schoolId: true,
          },
        },
        students: {
          select: {
            id: true,
            enrollmentNumber: true,
            dateOfBirth: true,
            grade: true,
            schoolId: true,
            parentId: true,
          },
        },
        parents: {
          select: {
            id: true,
            phone: true,
            address: true,
            occupation: true,
            schoolId: true,
          },
        },
      },
    });

    if (!profile) {
      throw new AppError('User not found', 404);
    }

    const roles = await prisma.userRole.findMany({
      where: { userId: profile.id },
      select: { id: true, role: true, schoolId: true, createdAt: true },
    });

    res.status(200).json({
      profile: {
        id: profile.id,
        full_name: profile.fullName,
        email: profile.email,
        avatar_url: profile.avatarUrl,
        phone: profile.phone,
        must_change_password: profile.mustChangePassword,
        preferred_language: profile.preferredLanguage,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
        roles,
        teacher: profile.teachers[0] || null,
        student: profile.students[0] || null,
        parent: profile.parents[0] || null,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get my profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { full_name, phone, avatar_url, preferred_language } = req.body;

    const existing = await prisma.profile.findUnique({
      where: { id: req.user.userId },
    });

    if (!existing) {
      throw new AppError('User not found', 404);
    }

    const updated = await prisma.profile.update({
      where: { id: req.user.userId },
      data: {
        ...(full_name !== undefined && { fullName: full_name }),
        ...(phone !== undefined && { phone }),
        ...(avatar_url !== undefined && { avatarUrl: avatar_url }),
        ...(preferred_language !== undefined && { preferredLanguage: preferred_language }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        phone: true,
        mustChangePassword: true,
        preferredLanguage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAuditEvent({
      action: 'update_my_profile',
      entityType: 'profile',
      entityId: req.user.userId,
      userId: req.user.userId,
      details: {
        ...(full_name !== undefined && { full_name }),
        ...(phone !== undefined && { phone }),
      },
    });

    res.status(200).json({
      profile: {
        id: updated.id,
        full_name: updated.fullName,
        email: updated.email,
        avatar_url: updated.avatarUrl,
        phone: updated.phone,
        must_change_password: updated.mustChangePassword,
        preferred_language: updated.preferredLanguage,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update my profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const oldProfile = await prisma.profile.findUnique({
      where: { id: req.user.userId },
      select: { avatarUrl: true },
    });

    const relativePath = path
      .normalize(req.file.path)
      .split(path.sep)
      .join('/')
      .replace(/^\.\//, '');

    const avatarUrl = `${env.apiUrl}/${relativePath}`;

    const updated = await prisma.profile.update({
      where: { id: req.user.userId },
      data: { avatarUrl },
      select: {
        id: true,
        avatarUrl: true,
        updatedAt: true,
      },
    });

    if (oldProfile?.avatarUrl && oldProfile.avatarUrl.startsWith(`${env.apiUrl}/`)) {
      const oldPath = oldProfile.avatarUrl.replace(`${env.apiUrl}/`, '');
      const absoluteOldPath = path.resolve(oldPath);
      if (fs.existsSync(absoluteOldPath)) {
        try {
          fs.unlinkSync(absoluteOldPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    await logAuditEvent({
      action: 'upload_avatar',
      entityType: 'profile',
      entityId: req.user.userId,
      userId: req.user.userId,
      details: { avatar_url: avatarUrl },
    });

    res.status(200).json({
      avatar_url: updated.avatarUrl,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteAvatar(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const existing = await prisma.profile.findUnique({
      where: { id: req.user.userId },
      select: { avatarUrl: true },
    });

    if (existing?.avatarUrl && existing.avatarUrl.startsWith(`${env.apiUrl}/`)) {
      const oldPath = existing.avatarUrl.replace(`${env.apiUrl}/`, '');
      const absoluteOldPath = path.resolve(oldPath);
      if (fs.existsSync(absoluteOldPath)) {
        try {
          fs.unlinkSync(absoluteOldPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    await prisma.profile.update({
      where: { id: req.user.userId },
      data: { avatarUrl: null },
    });

    await logAuditEvent({
      action: 'delete_avatar',
      entityType: 'profile',
      entityId: req.user.userId,
      userId: req.user.userId,
    });

    res.status(200).json({ message: 'Avatar deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Delete avatar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function saveSettings(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      throw new AppError('Settings object is required', 400);
    }

    const updated = await prisma.profile.update({
      where: { id: req.user.userId },
      data: { preferences: JSON.stringify(settings) },
      select: { id: true, preferences: true, updatedAt: true },
    });

    await logAuditEvent({
      action: 'save_user_settings',
      entityType: 'profile',
      entityId: req.user.userId,
      userId: req.user.userId,
      details: { keys: Object.keys(settings) },
    });

    res.status(200).json({ settings: settings });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Save settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const profile = await prisma.profile.findUnique({
      where: { id: req.user.userId },
      select: { preferences: true },
    });

    let settings = null;
    if (profile?.preferences) {
      try {
        settings = JSON.parse(profile.preferences);
      } catch {
        settings = null;
      }
    }

    res.status(200).json({ settings });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
