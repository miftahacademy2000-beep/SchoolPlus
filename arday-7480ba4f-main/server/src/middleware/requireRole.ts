import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AppError } from './errorHandler.js';

type AppRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

export function requireRole(...roles: AppRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const schoolId = req.params.schoolId || (req.query.school_id as string) || (req.body.school_id as string);

      const where: Record<string, unknown> = {
        userId: req.user.userId,
      };

      if (schoolId) {
        where.schoolId = schoolId;
      }

      const userRole = await prisma.userRole.findFirst({
        where: where as never,
      });

      if (!userRole) {
        throw new AppError('No role found for this user', 403);
      }

      if (!roles.includes(userRole.role as AppRole)) {
        throw new AppError('Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Role check failed' });
    }
  };
}

export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: req.user.userId,
        role: 'super_admin',
        schoolId: null,
      },
    });

    if (!userRole) {
      throw new AppError('Super admin access required', 403);
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Role check failed' });
  }
}

export function requireSchoolRole(...roles: AppRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const schoolId = req.params.schoolId || req.params.id;

      if (!schoolId) {
        throw new AppError('School ID is required', 400);
      }

      const userRole = await prisma.userRole.findFirst({
        where: {
          userId: req.user.userId,
          schoolId: schoolId,
        },
      });

      if (!userRole) {
        throw new AppError('No role found for this user in this school', 403);
      }

      if (!roles.includes(userRole.role as AppRole)) {
        throw new AppError('Insufficient permissions for this school', 403);
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'School role check failed' });
    }
  };
}
