import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { AppError } from './errorHandler.js';

type AppRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

/**
 * Collect every school identifier the caller supplied. Clients must never be
 * able to mix values (for example `?school_id=own` while the body targets a
 * different school), so more than one distinct value is rejected.
 */
function collectRequestedSchoolIds(req: Request): string[] {
  const raw = [
    req.params.schoolId,
    req.params.school_id,
    req.query.school_id,
    (req.body && req.body.school_id) as unknown,
    (req.body && req.body.from_school_id) as unknown,
    (req.body && req.body.to_school_id) as unknown,
  ];

  const ids = new Set<string>();
  for (const value of raw) {
    if (typeof value === 'string' && value.trim().length > 0) {
      ids.add(value.trim());
    }
  }
  return [...ids];
}

function resolveRequestedSchoolId(req: Request): string | undefined {
  const ids = collectRequestedSchoolIds(req);
  if (ids.length > 1) {
    throw new AppError('Conflicting school IDs were supplied', 400);
  }
  return ids[0];
}

export async function isGlobalSuperAdmin(userId: string): Promise<boolean> {
  const role = await prisma.userRole.findFirst({
    where: { userId, role: 'super_admin', schoolId: null },
    select: { id: true },
  });
  return Boolean(role);
}

/**
 * True when the user may act inside `schoolId`.
 * A global super admin is always allowed. Otherwise the user must have an
 * explicit role bound to that exact school and, when `allowedRoles` is given,
 * one of those roles.
 */
export async function userHasSchoolRole(
  userId: string,
  schoolId: string,
  allowedRoles?: AppRole[],
): Promise<boolean> {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: true, schoolId: true },
  });

  if (roles.some((role) => role.role === 'super_admin' && role.schoolId === null)) {
    return true;
  }

  return roles.some(
    (role) =>
      role.schoolId === schoolId
      && (allowedRoles ? allowedRoles.includes(role.role as AppRole) : true),
  );
}

async function userHasMembership(userId: string, schoolId: string): Promise<boolean> {
  if (await userHasSchoolRole(userId, schoolId)) {
    return true;
  }

  const membership = await prisma.membership.findFirst({
    where: { userId, schoolId, isActive: true },
    select: { id: true },
  });
  return Boolean(membership);
}

/**
 * Resolve the canonical school for a request, reject conflicting client
 * values, and verify the caller is authorised for that school.
 *
 * - A concrete school id is stored on `req.schoolId`.
 * - A global super admin may omit the id (global scope) or target any school.
 * - Every other caller must supply exactly one school id they belong to.
 */
export async function requireSchoolAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const schoolId = resolveRequestedSchoolId(req);
    const superAdmin = await isGlobalSuperAdmin(req.user.userId);

    if (!schoolId) {
      if (!superAdmin) {
        throw new AppError('School ID is required', 400);
      }
      // Global super admin: leave req.schoolId undefined to mean "all schools".
      next();
      return;
    }

    if (!superAdmin) {
      const allowed = await userHasMembership(req.user.userId, schoolId);
      if (!allowed) {
        throw new AppError('You do not have access to this school', 403);
      }
    }

    req.schoolId = schoolId;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'School access check failed' });
  }
}

/**
 * Verify access to a school discovered from a resource (never trusted from the
 * client) and optionally require one of `allowedRoles` in that school.
 * Throws `AppError` so handlers can reuse their existing error responses.
 */
export async function ensureSchoolAccess(
  req: Request,
  schoolId: string,
  allowedRoles?: AppRole[],
): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  if (req.schoolId && req.schoolId !== schoolId) {
    throw new AppError('You do not have access to this school', 403);
  }

  const allowed = await userHasSchoolRole(req.user.userId, schoolId, allowedRoles);
  if (!allowed) {
    throw new AppError(
      allowedRoles
        ? 'You do not have permission to perform this action'
        : 'You do not have access to this school',
      403,
    );
  }

  req.schoolId = schoolId;
}

/**
 * Middleware form of `ensureSchoolAccess` for routes whose school is already
 * known (for example `analytics/school/:id`).
 */
export function requireSchoolRole(...allowedRoles: AppRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      if (!req.schoolId) {
        throw new AppError('School ID is required', 400);
      }

      await ensureSchoolAccess(req, req.schoolId, allowedRoles);
      next();
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Middleware that restricts access based on a role held in any school.
 * Usage: requireRole('super_admin') or requireRole('school_admin', 'teacher').
 *
 * Prefer `requireSchoolRole` for tenant-scoped routes.
 */
export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const roles = await prisma.userRole.findMany({
        where: { userId: req.user.userId },
        select: { role: true, schoolId: true },
      });

      const hasRole = roles.some(
        (r) => allowedRoles.includes(r.role) || (r.role === 'super_admin' && r.schoolId === null),
      );
      if (!hasRole) {
        throw new AppError('You do not have permission to perform this action', 403);
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Requires the user to be a global super_admin.
 */
export function requireSuperAdmin() {
  return requireRole('super_admin');
}
