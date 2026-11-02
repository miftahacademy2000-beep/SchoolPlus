import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAuditEvent } from '../utils/auditLog.js';

interface TokenPayload {
  userId: string;
  email: string;
}

function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret!, {
    expiresIn: env.jwtExpiresIn as NonNullable<SignOptions['expiresIn']>,
  });
}

function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret!, {
    expiresIn: env.jwtRefreshExpiresIn as NonNullable<SignOptions['expiresIn']>,
  });
}

function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, login_id, password } = req.body;

    if (!email && !login_id) {
      throw new AppError('Email or login_id is required', 400);
    }

    let profile: Awaited<ReturnType<typeof prisma.profile.findFirst>> = null;

    if (email) {
      profile = await prisma.profile.findFirst({
        where: { email },
      });
    } else if (login_id) {
      profile = await prisma.profile.findFirst({
        where: { loginId: login_id },
      });
      if (!profile) {
        profile = await prisma.profile.findFirst({
          where: {
            OR: [
              { email: login_id },
              { email: `${login_id}@school.local` },
            ],
          },
        });
      }
    }

    if (!profile) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!profile.passwordHash) {
      throw new AppError('Password not set for this account. Please contact administrator.', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, profile.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId: profile.id },
      select: {
        id: true,
        role: true,
        schoolId: true,
      },
    });

    const tokenPayload: TokenPayload = {
      userId: profile.id,
      email: profile.email || '',
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await logAuditEvent({
      action: 'login',
      entityType: 'profile',
      entityId: profile.id,
      userId: profile.id,
      details: { email: profile.email, login_id },
    });

    res.status(200).json({
      access_token: accessToken,
      refresh_token: refreshToken,
      must_change_password: profile.mustChangePassword,
      user: {
        id: profile.id,
        full_name: profile.fullName,
        email: profile.email,
        avatar_url: profile.avatarUrl,
        phone: profile.phone,
        must_change_password: profile.mustChangePassword,
        preferred_language: profile.preferredLanguage,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
      },
      roles: userRoles.map(({ id, role, schoolId }) => ({
        id,
        role,
        school_id: schoolId,
      })),
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, full_name, role, school_id, phone } = req.body;

    if (!email || !password || !full_name || !role) {
      throw new AppError('Email, password, full_name, and role are required', 400);
    }

    if (role !== 'super_admin' && !school_id) {
      throw new AppError('School ID is required for non-super-admin roles', 400);
    }

    const existingProfile = await prisma.profile.findFirst({
      where: { email },
    });

    if (existingProfile) {
      throw new AppError('A user with this email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userId = crypto.randomUUID();

    const profile = await prisma.profile.create({
      data: {
        id: userId,
        email,
        fullName: full_name,
        passwordHash,
        phone: phone || null,
        createdAt: new Date(),
        mustChangePassword: false,
        preferredLanguage: 'en',
      },
    });

    if (school_id || role === 'super_admin') {
      await prisma.userRole.create({
        data: {
          userId: profile.id,
          role: role as 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent',
          schoolId: school_id || null,
          createdAt: new Date(),
        },
      });
    }

    if (school_id) {
      await prisma.membership.create({
        data: {
          userId: profile.id,
          schoolId: school_id,
          isActive: true,
          createdAt: new Date(),
        },
      });
    }

    const tokenPayload: TokenPayload = {
      userId: profile.id,
      email: profile.email || '',
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await logAuditEvent({
      action: 'register',
      entityType: 'profile',
      entityId: profile.id,
      userId: profile.id,
      schoolId: school_id || undefined,
      details: { email, full_name, role },
    });

    res.status(201).json({
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: profile.id,
        full_name: profile.fullName,
        email: profile.email,
        avatar_url: profile.avatarUrl,
        phone: profile.phone,
        must_change_password: profile.mustChangePassword,
        preferred_language: profile.preferredLanguage,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
      },
      roles: school_id || role === 'super_admin'
        ? [{ role, school_id: school_id || null }]
        : [],
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const profile = await prisma.profile.findUnique({
      where: { id: req.user.userId },
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

    if (!profile) {
      throw new AppError('User not found', 404);
    }

    const roles = await prisma.userRole.findMany({
      where: { userId: req.user.userId },
      select: {
        id: true,
        role: true,
        schoolId: true,
        createdAt: true,
      },
    });

    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.userId },
      select: {
        id: true,
        schoolId: true,
        isActive: true,
      },
    });

    res.status(200).json({
      user: {
        id: profile.id,
        full_name: profile.fullName,
        email: profile.email,
        avatar_url: profile.avatarUrl,
        phone: profile.phone,
        must_change_password: profile.mustChangePassword,
        preferred_language: profile.preferredLanguage,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
      },
      roles: roles.map(({ id, role, schoolId, createdAt }) => ({
        id,
        role,
        school_id: schoolId,
        created_at: createdAt,
      })),
      memberships: memberships.map(({ id, schoolId, isActive }) => ({
        id,
        school_id: schoolId,
        is_active: isActive,
      })),
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw new AppError('Refresh token is required', 400);
    }

    const decoded = jwt.verify(refresh_token, env.jwtRefreshSecret!) as TokenPayload;

    const profile = await prisma.profile.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true },
    });

    if (!profile) {
      throw new AppError('User not found', 401);
    }

    const tokenPayload: TokenPayload = {
      userId: profile.id,
      email: profile.email || '',
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    res.status(200).json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Refresh token expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const profile = await prisma.profile.findFirst({
      where: { email },
    });

    if (!profile) {
      res.status(200).json({ message: 'If an account with that email exists, a reset link has been sent.' });
      return;
    }

    const resetToken = generatePasswordResetToken();

    const tokenHash = await bcrypt.hash(resetToken, 10);

    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        mustChangePassword: true,
      },
    });

    await logAuditEvent({
      action: 'forgot_password',
      entityType: 'profile',
      entityId: profile.id,
      userId: profile.id,
      details: { email },
    });

    res.status(200).json({
      message: 'If an account with that email exists, a reset link has been sent.',
      ...(process.env.NODE_ENV === 'development' && { reset_token: resetToken }),
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      throw new AppError('Token and password are required', 400);
    }

    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    const profiles = await prisma.profile.findMany({
      where: { mustChangePassword: true },
    });

    let matchedProfile = null;

    for (const p of profiles) {
      if (p.passwordHash) {
        const matches = await bcrypt.compare(token, p.passwordHash);
        if (matches) {
          matchedProfile = p;
          break;
        }
      }
    }

    if (!matchedProfile) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.profile.update({
      where: { id: matchedProfile.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    await logAuditEvent({
      action: 'reset_password',
      entityType: 'profile',
      entityId: matchedProfile.id,
      userId: matchedProfile.id,
    });

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updatePassword(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
      throw new AppError('New password must be at least 6 characters', 400);
    }

    const profile = await prisma.profile.findUnique({
      where: { id: req.user.userId },
    });

    if (!profile) {
      throw new AppError('User not found', 404);
    }

    if (!profile.passwordHash) {
      throw new AppError('Password not set for this account', 400);
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, profile.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.profile.update({
      where: { id: req.user.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    await logAuditEvent({
      action: 'update_password',
      entityType: 'profile',
      entityId: req.user.userId,
      userId: req.user.userId,
    });

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
