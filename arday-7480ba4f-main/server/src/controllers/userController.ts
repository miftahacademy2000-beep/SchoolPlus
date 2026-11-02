import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAuditEvent } from '../utils/auditLog.js';

async function generateEnrollmentNumber(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.student.count({
    where: { schoolId },
  });
  const seq = String(count + 1).padStart(4, '0');
  return `STU-${year}-${seq}`;
}

async function generateEmployeeId(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.teacher.count({
    where: { schoolId },
  });
  const seq = String(count + 1).padStart(4, '0');
  return `EMP-${year}-${seq}`;
}

async function canAccessUserProfile(
  actorId: string,
  targetId: string,
  allowedRoles: string[],
): Promise<boolean> {
  if (actorId === targetId) return true;

  const [actorRoles, targetRoles] = await Promise.all([
    prisma.userRole.findMany({ where: { userId: actorId }, select: { role: true, schoolId: true } }),
    prisma.userRole.findMany({ where: { userId: targetId }, select: { role: true, schoolId: true } }),
  ]);
  if (actorRoles.some((role) => role.role === 'super_admin' && role.schoolId === null)) return true;

  const targetSchoolIds = new Set(targetRoles.map((role) => role.schoolId).filter(Boolean));
  return actorRoles.some((role) =>
    role.schoolId !== null
    && targetSchoolIds.has(role.schoolId)
    && allowedRoles.includes(role.role),
  );
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '50', search = '', role = '', school_id = '' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    if (role || school_id) {
      const matchingRoles = await prisma.userRole.findMany({
        where: {
          ...(role ? { role: role as 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent' } : {}),
          ...(school_id ? { schoolId: school_id as string } : {}),
        },
        select: { userId: true },
      });
      where.id = { in: matchingRoles.map(({ userId }) => userId) };
    }

    const [profiles, total] = await Promise.all([
      prisma.profile.findMany({
        where: where as never,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
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
      }),
      prisma.profile.count({ where: where as never }),
    ]);
    const userRoles = profiles.length
      ? await prisma.userRole.findMany({
          where: { userId: { in: profiles.map((profile) => profile.id) } },
          select: { id: true, userId: true, role: true, schoolId: true, createdAt: true },
        })
      : [];

    res.status(200).json({
      users: profiles.map((p) => ({
        id: p.id,
        full_name: p.fullName,
        email: p.email,
        avatar_url: p.avatarUrl,
        phone: p.phone,
        must_change_password: p.mustChangePassword,
        preferred_language: p.preferredLanguage,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
        roles: userRoles.filter((role) => role.userId === p.id),
        teacher: p.teachers[0] || null,
        student: p.students[0] || null,
        parent: p.parents[0] || null,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('List users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const profile = await prisma.profile.findUnique({
      where: { id },
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
    if (!await canAccessUserProfile(req.user!.userId, id, ['school_admin', 'teacher'])) {
      throw new AppError('You do not have permission to view this user', 403);
    }
    const userRoles = await prisma.userRole.findMany({
      where: { userId: id },
      select: { id: true, role: true, schoolId: true, createdAt: true },
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
        roles: userRoles,
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
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const {
      email,
      login_id,
      password,
      full_name,
      role,
      school_id,
      phone,
      employee_id,
      department,
      subjects,
      enrollment_number,
      date_of_birth,
      grade,
      parent_id,
      address,
      occupation,
    } = req.body;

    if ((!login_id && !email) || !password || !full_name || !role || !school_id) {
      throw new AppError('email or login_id, password, full_name, role, and school_id are required', 400);
    }

    const currentSchoolRole = await prisma.userRole.findFirst({
      where: {
        userId: req.user!.userId,
        schoolId: school_id,
        role: { in: ['super_admin', 'school_admin'] },
      },
    });
    const superAdmin = await prisma.userRole.findFirst({
      where: { userId: req.user!.userId, role: 'super_admin', schoolId: null },
    });
    if (!currentSchoolRole && !superAdmin) {
      throw new AppError('You do not have permission to create users for this school', 403);
    }

    const profileEmail = email || `${login_id}@school.local`;

    const existingSchool = await prisma.school.findUnique({
      where: { id: school_id },
    });

    if (!existingSchool) {
      throw new AppError('School not found', 404);
    }

    if (role === 'student' && enrollment_number) {
      const existingStudent = await prisma.student.findFirst({
        where: { schoolId: school_id, enrollmentNumber: enrollment_number },
        include: {
          profile: {
            select: { id: true, fullName: true, email: true, loginId: true, phone: true, avatarUrl: true },
          },
        },
      });
      if (existingStudent) {
        res.status(200).json({
          existing: true,
          user: {
            id: existingStudent.userId,
            full_name: existingStudent.profile?.fullName,
            email: existingStudent.profile?.email,
            phone: existingStudent.profile?.phone,
            student: existingStudent,
          },
          login_id: existingStudent.profile?.loginId ?? existingStudent.profile?.email?.split('@')[0] ?? null,
        });
        return;
      }
    }

    const existingProfile = await prisma.profile.findFirst({
      where: {
        OR: [
          { email: profileEmail },
          ...(login_id ? [{ loginId: login_id }] : []),
        ],
      },
    });
    if (existingProfile) {
      throw new AppError('A user with this email/login_id already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();
    let parsedDob: Date | null = null;
    if (date_of_birth) {
      parsedDob = new Date(date_of_birth);
      if (isNaN(parsedDob.getTime())) {
        throw new AppError('Invalid date of birth', 400);
      }
    }
    const enrollNum = role === 'student'
      ? enrollment_number || await generateEnrollmentNumber(school_id)
      : undefined;
    const empId = role === 'teacher'
      ? employee_id || await generateEmployeeId(school_id)
      : undefined;

    const { profile, roleRecord } = await prisma.$transaction(async (tx) => {
      const createdProfile = await tx.profile.create({
        data: {
          id: userId,
          email: profileEmail,
          loginId: login_id || null,
          fullName: full_name,
          passwordHash,
          phone: phone || null,
          createdAt: new Date(),
          mustChangePassword: false,
          preferredLanguage: 'en',
        },
      });

      await tx.userRole.create({
        data: {
          userId: createdProfile.id,
          role: role as 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent',
          schoolId: school_id,
          createdAt: new Date(),
        },
      });

      await tx.membership.create({
        data: {
          userId: createdProfile.id,
          schoolId: school_id,
          isActive: true,
          createdAt: new Date(),
        },
      });

      let createdRole: unknown = null;
      if (role === 'teacher') {
        createdRole = await tx.teacher.create({
          data: {
            userId: createdProfile.id,
            schoolId: school_id,
            employeeId: empId!,
            department: department || null,
            subjects: subjects || null,
            shift: 'morning',
            status: 'active',
            createdAt: new Date(),
          },
        });
      } else if (role === 'student') {
        createdRole = await tx.student.create({
          data: {
            userId: createdProfile.id,
            schoolId: school_id,
            enrollmentNumber: enrollNum!,
            dateOfBirth: parsedDob,
            grade: grade || null,
            parentId: parent_id || null,
            createdAt: new Date(),
          },
        });
      } else if (role === 'parent') {
        createdRole = await tx.parent.create({
          data: {
            userId: createdProfile.id,
            schoolId: school_id,
            phone: phone ? BigInt(phone) : 0n,
            address: address || null,
            occupation: occupation || null,
            createdAt: new Date(),
          },
        });
      }
      return { profile: createdProfile, roleRecord: createdRole };
    });

    await logAuditEvent({
      action: 'create_user',
      entityType: 'profile',
      entityId: profile.id,
      userId: req.user?.userId,
      schoolId: school_id,
      details: { full_name, email: profileEmail, role, login_id },
    });

    const userRoles = await prisma.userRole.findMany({
      where: { userId: profile.id },
      select: { id: true, role: true, schoolId: true },
    });

    res.status(201).json({
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
        roles: userRoles,
        teacher: role === 'teacher' ? roleRecord : null,
        student: role === 'student' ? roleRecord : null,
        parent: role === 'parent' ? roleRecord : null,
      },
      login_id,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { full_name, email, phone, avatar_url, must_change_password, preferred_language } = req.body;

    const existing = await prisma.profile.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('User not found', 404);
    }
    if (!await canAccessUserProfile(req.user!.userId, id, ['school_admin'])) {
      throw new AppError('You do not have permission to update this user', 403);
    }

    if (email && email !== existing.email) {
      const emailTaken = await prisma.profile.findFirst({
        where: { email, id: { not: id } },
      });
      if (emailTaken) {
        throw new AppError('Email is already in use', 409);
      }
    }

    const updated = await prisma.profile.update({
      where: { id },
      data: {
        ...(full_name !== undefined && { fullName: full_name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(avatar_url !== undefined && { avatarUrl: avatar_url }),
        ...(must_change_password !== undefined && { mustChangePassword: must_change_password }),
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
      action: 'update_user',
      entityType: 'profile',
      entityId: id,
      userId: req.user?.userId,
      details: { full_name, email, phone },
    });

    res.status(200).json({
      user: {
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
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.profile.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError('User not found', 404);
    }
    if (!await canAccessUserProfile(req.user!.userId, id, ['school_admin'])) {
      throw new AppError('You do not have permission to delete this user', 403);
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId: id },
    });

    for (const ur of userRoles) {
      if (ur.role === 'teacher') {
        await prisma.teacher.deleteMany({ where: { userId: id } });
      } else if (ur.role === 'student') {
        await prisma.student.deleteMany({ where: { userId: id } });
      } else if (ur.role === 'parent') {
        await prisma.parent.deleteMany({ where: { userId: id } });
      }
    }

    await prisma.membership.deleteMany({ where: { userId: id } });
    await prisma.userRole.deleteMany({ where: { userId: id } });
    await prisma.profile.delete({ where: { id } });

    await logAuditEvent({
      action: 'delete_user',
      entityType: 'profile',
      entityId: id,
      userId: req.user?.userId,
      details: { full_name: existing.fullName, email: existing.email },
    });

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function addRole(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { role, school_id } = req.body;

    if (!role || !school_id) {
      throw new AppError('role and school_id are required', 400);
    }

    const existing = await prisma.profile.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('User not found', 404);
    }

    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId: id,
        role: role as 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent',
        schoolId: school_id,
      },
    });

    if (existingRole) {
      throw new AppError('User already has this role in this school', 409);
    }

    const newRole = await prisma.userRole.create({
      data: {
        userId: id,
        role: role as 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent',
        schoolId: school_id,
        createdAt: new Date(),
      },
    });

    const existingMembership = await prisma.membership.findFirst({
      where: { userId: id, schoolId: school_id },
    });
    if (existingMembership) {
      await prisma.membership.update({
        where: { id: existingMembership.id },
        data: { isActive: true },
      });
    } else {
      await prisma.membership.create({
        data: {
          userId: id,
          schoolId: school_id,
          isActive: true,
          createdAt: new Date(),
        },
      });
    }

    if (role === 'teacher') {
      const empId = await generateEmployeeId(school_id);
      const existingTeacher = await prisma.teacher.findFirst({
        where: { userId: id, schoolId: school_id },
      });
      if (!existingTeacher) {
        await prisma.teacher.create({
          data: {
            userId: id,
            schoolId: school_id,
            employeeId: empId,
            shift: 'morning',
            status: 'active',
            createdAt: new Date(),
          },
        });
      }
    } else if (role === 'student') {
      const enrollNum = await generateEnrollmentNumber(school_id);
      const existingStudent = await prisma.student.findFirst({
        where: { userId: id, schoolId: school_id },
      });
      if (!existingStudent) {
        await prisma.student.create({
          data: {
            userId: id,
            schoolId: school_id,
            enrollmentNumber: enrollNum,
            createdAt: new Date(),
          },
        });
      }
    } else if (role === 'parent') {
      const existingParent = await prisma.parent.findFirst({
        where: { userId: id, schoolId: school_id },
      });
      if (!existingParent) {
        await prisma.parent.create({
          data: {
            userId: id,
            schoolId: school_id,
            phone: 0n,
            createdAt: new Date(),
          },
        });
      }
    }

    await logAuditEvent({
      action: 'add_role',
      entityType: 'user_role',
      entityId: newRole.id,
      userId: req.user?.userId,
      schoolId: school_id,
      details: { target_user: id, role },
    });

    res.status(201).json({
      role: newRole,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Add role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function removeRole(req: Request, res: Response): Promise<void> {
  try {
    const { id, roleId } = req.params;

    const role = await prisma.userRole.findUnique({
      where: { id: roleId },
    });

    if (!role || role.userId !== id) {
      throw new AppError('Role not found', 404);
    }

    await prisma.userRole.delete({
      where: { id: roleId },
    });

    const memberships = await prisma.membership.findMany({
      where: { userId: id },
    });

    for (const membership of memberships) {
      const roleCount = await prisma.userRole.count({
        where: {
          userId: id,
          schoolId: membership.schoolId,
        },
      });

      if (roleCount === 0) {
        await prisma.membership.delete({
          where: { id: membership.id },
        });
      }
    }

    await logAuditEvent({
      action: 'remove_role',
      entityType: 'user_role',
      entityId: roleId,
      userId: req.user?.userId,
      schoolId: role.schoolId || undefined,
      details: { target_user: id, role: role.role },
    });

    res.status(200).json({ message: 'Role removed successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Remove role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateCredentials(req: Request, res: Response): Promise<void> {
  try {
    const {
      user_id,
      userId,
      school_id,
      password,
      new_password,
      email,
      new_email,
      login_id,
      new_login_id,
      full_name,
      fullName,
      phone,
      enrollment_number,
      grade,
      date_of_birth,
      parent_id,
      must_change_password,
    } = req.body;

    const resolvedUserId = user_id ?? userId;
    const resolvedPassword = password ?? new_password;
    const resolvedEmail = email ?? new_email;
    const resolvedLoginId = login_id ?? new_login_id;
    const resolvedFullName = full_name ?? fullName;

    if (!resolvedUserId) {
      throw new AppError('user_id is required', 400);
    }

    const existing = await prisma.profile.findUnique({
      where: { id: resolvedUserId },
    });

    if (!existing) {
      throw new AppError('User not found', 404);
    }

    const [superAdmin, schoolAdmin, targetSchoolRole] = await Promise.all([
      prisma.userRole.findFirst({
        where: { userId: req.user!.userId, role: 'super_admin', schoolId: null },
      }),
      school_id
        ? prisma.userRole.findFirst({
            where: { userId: req.user!.userId, role: 'school_admin', schoolId: school_id },
          })
        : Promise.resolve(null),
      school_id
        ? prisma.userRole.findFirst({
            where: { userId: resolvedUserId, schoolId: school_id },
          })
        : Promise.resolve(null),
    ]);
    if (!superAdmin && (!schoolAdmin || !targetSchoolRole)) {
      throw new AppError('You do not have permission to update this account', 403);
    }

    const nextLoginId = resolvedLoginId?.trim();
    const nextPassword = resolvedPassword;
    const nextEmail = resolvedEmail?.trim();
    const nextFullName = resolvedFullName?.trim();

    if (nextEmail && nextEmail !== existing.email) {
      const emailTaken = await prisma.profile.findFirst({
        where: { email: nextEmail, id: { not: resolvedUserId } },
      });
      if (emailTaken) {
        throw new AppError('Email is already in use', 409);
      }
    }

    if (nextLoginId) {
      const loginIdTaken = await prisma.profile.findFirst({
        where: {
          id: { not: resolvedUserId },
          OR: [
            { loginId: nextLoginId },
            { email: `${nextLoginId}@school.local` },
          ],
        },
      });
      if (loginIdTaken) {
        throw new AppError('Login ID is already in use', 409);
      }
    }

    const updateData: Record<string, unknown> = {};

    if (nextPassword) {
      updateData.passwordHash = await bcrypt.hash(nextPassword, 12);
      updateData.mustChangePassword = must_change_password ?? true;
    }

    if (nextEmail) {
      updateData.email = nextEmail;
    }

    if (nextLoginId) {
      updateData.loginId = nextLoginId;
      if (existing.email?.endsWith('@school.local')) {
        updateData.email = `${nextLoginId}@school.local`;
      }
    }

    if (nextFullName) {
      updateData.fullName = nextFullName;
    }

    if (phone !== undefined) {
      updateData.phone = phone || null;
    }

    if (must_change_password !== undefined) {
      updateData.mustChangePassword = must_change_password;
    }

    const studentData: Record<string, unknown> = {};
    if (enrollment_number !== undefined) studentData.enrollmentNumber = enrollment_number;
    if (grade !== undefined) studentData.grade = grade;
    if (date_of_birth !== undefined) {
      const date = date_of_birth ? new Date(date_of_birth) : null;
      if (date && Number.isNaN(date.getTime())) {
        throw new AppError('Invalid date of birth', 400);
      }
      studentData.dateOfBirth = date;
    }
    if (parent_id !== undefined) studentData.parentId = parent_id;
    if (Object.keys(updateData).length === 0 && Object.keys(studentData).length === 0) {
      throw new AppError('No fields to update', 400);
    }
    if (Object.keys(studentData).length > 0 && targetSchoolRole?.role !== 'student') {
      throw new AppError('Student fields can only be changed on a student account', 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedProfile = await tx.profile.update({
        where: { id: resolvedUserId },
        data: updateData,
        select: {
          id: true,
          fullName: true,
          email: true,
          loginId: true,
          phone: true,
          mustChangePassword: true,
          updatedAt: true,
        },
      });
      if (Object.keys(studentData).length > 0) {
        const result = await tx.student.updateMany({
          where: { userId: resolvedUserId, schoolId: school_id },
          data: studentData,
        });
        if (result.count !== 1) {
          throw new AppError('Student record not found in the selected school', 404);
        }
      }
      return updatedProfile;
    });

    await logAuditEvent({
      action: 'update_credentials',
      entityType: 'profile',
      entityId: resolvedUserId,
      userId: req.user?.userId,
      details: {
        email_changed: resolvedEmail !== undefined,
        login_id_changed: resolvedLoginId !== undefined,
        password_changed: resolvedPassword !== undefined,
        full_name_changed: resolvedFullName !== undefined,
      },
    });

    res.status(200).json({
      user: {
        id: updated.id,
        full_name: updated.fullName,
        email: updated.email,
        login_id: updated.loginId,
        phone: updated.phone,
        must_change_password: updated.mustChangePassword,
        updated_at: updated.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update credentials error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
