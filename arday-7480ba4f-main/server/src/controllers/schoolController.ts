import { Request, Response } from 'express';
import crypto from 'crypto';

import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAuditEvent } from '../utils/auditLog.js';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + crypto.randomUUID().slice(0, 8);
}

export async function listSchools(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '50', search = '', status = '' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    if (status) {
      where.status = status as 'active' | 'suspended' | 'pending';
    }

    const [schools, total] = await Promise.all([
      prisma.school.findMany({
        where: where as never,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.school.count({ where: where as never }),
    ]);

    const schoolIds = schools.map((s) => s.id);

    const [studentCounts, teacherCounts, courseCounts, classCounts] = await Promise.all([
      schoolIds.length
        ? prisma.student.groupBy({ by: ['schoolId'], where: { schoolId: { in: schoolIds } }, _count: true })
        : [],
      schoolIds.length
        ? prisma.teacher.groupBy({ by: ['schoolId'], where: { schoolId: { in: schoolIds } }, _count: true })
        : [],
      schoolIds.length
        ? prisma.course.groupBy({ by: ['schoolId'], where: { schoolId: { in: schoolIds } }, _count: true })
        : [],
      schoolIds.length
        ? prisma.class.groupBy({ by: ['schoolId'], where: { schoolId: { in: schoolIds } }, _count: true })
        : [],
    ]);

    const countMap = (rows: { schoolId: string; _count: number }[]) => {
      const map: Record<string, number> = {};
      for (const row of rows) map[row.schoolId] = row._count;
      return map;
    };

    const studentMap = countMap(studentCounts as { schoolId: string; _count: number }[]);
    const teacherMap = countMap(teacherCounts as { schoolId: string; _count: number }[]);
    const courseMap = countMap(courseCounts as { schoolId: string; _count: number }[]);
    const classMap = countMap(classCounts as { schoolId: string; _count: number }[]);

    res.status(200).json({
      schools: schools.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        logo_url: s.logoUrl,
        address: s.address,
        phone: s.phone,
        email: s.email,
        website: s.website,
        status: s.status,
        plan: s.plan,
        monthly_fee: s.monthlyFee,
        created_by: s.createdBy,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
        counts: {
          students: studentMap[s.id] || 0,
          teachers: teacherMap[s.id] || 0,
          courses: courseMap[s.id] || 0,
          classes: classMap[s.id] || 0,
        },
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
    console.error('List schools error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getSchoolById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const school = await prisma.school.findUnique({
      where: { id },
    });

    if (!school) {
      throw new AppError('School not found', 404);
    }

    const [students, teachers, courses, classes] = await Promise.all([
      prisma.student.count({ where: { schoolId: id } }),
      prisma.teacher.count({ where: { schoolId: id } }),
      prisma.course.count({ where: { schoolId: id } }),
      prisma.class.count({ where: { schoolId: id } }),
    ]);

    res.status(200).json({
      school: {
        id: school.id,
        name: school.name,
        slug: school.slug,
        logo_url: school.logoUrl,
        address: school.address,
        phone: school.phone,
        email: school.email,
        website: school.website,
        status: school.status,
        plan: school.plan,
        monthly_fee: school.monthlyFee,
        created_by: school.createdBy,
        created_at: school.createdAt,
        updated_at: school.updatedAt,
        counts: {
          students,
          teachers,
          courses,
          classes,
        },
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get school error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createSchool(req: Request, res: Response): Promise<void> {
  try {
    const { name, slug, logo_url, address, phone, email, website, monthly_fee } = req.body;

    if (!name) {
      throw new AppError('School name is required', 400);
    }

    const schoolSlug = slug || generateSlug(name);

    const existingSlug = await prisma.school.findFirst({
      where: { slug: schoolSlug },
    });

    if (existingSlug) {
      throw new AppError('A school with this slug already exists', 409);
    }

    const school = await prisma.school.create({
      data: {
        name,
        slug: schoolSlug,
        logoUrl: logo_url || '',
        address: address || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        monthlyFee: monthly_fee || null,
        createdBy: req.user?.userId || null,
        status: 'pending',
        plan: 'free',
        brand_color: '#000000',
        department_type: 'General',
        is_enabled: true,
        currency: 'USD',
        createdAt: new Date(),
      },
    });

    if (req.user) {
      await prisma.userRole.create({
        data: {
          userId: req.user.userId,
          role: 'school_admin',
          schoolId: school.id,
          createdAt: new Date(),
        },
      });

      const membership = await prisma.membership.findFirst({
        where: { userId: req.user.userId, schoolId: school.id },
      });
      if (membership) {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { isActive: true },
        });
      } else {
        await prisma.membership.create({
          data: {
          userId: req.user.userId,
          schoolId: school.id,
            isActive: true,
            createdAt: new Date(),
          },
        });
      }
    }

    await logAuditEvent({
      action: 'create_school',
      entityType: 'school',
      entityId: school.id,
      userId: req.user?.userId,
      schoolId: school.id,
      details: { name, slug: schoolSlug },
    });

    res.status(201).json({
      school: {
        id: school.id,
        name: school.name,
        slug: school.slug,
        logo_url: school.logoUrl,
        address: school.address,
        phone: school.phone,
        email: school.email,
        website: school.website,
        status: school.status,
        plan: school.plan,
        monthly_fee: school.monthlyFee,
        created_by: school.createdBy,
        created_at: school.createdAt,
        updated_at: school.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Create school error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateSchool(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, logo_url, address, phone, email, website, monthly_fee } = req.body;

    const existing = await prisma.school.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('School not found', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (logo_url !== undefined) updateData.logoUrl = logo_url;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (website !== undefined) updateData.website = website;
    if (monthly_fee !== undefined) updateData.monthlyFee = monthly_fee;

    if (Object.keys(updateData).length === 0) {
      throw new AppError('No fields to update', 400);
    }

    const updated = await prisma.school.update({
      where: { id },
      data: updateData,
    });

    await logAuditEvent({
      action: 'update_school',
      entityType: 'school',
      entityId: id,
      userId: req.user?.userId,
      schoolId: id,
      details: { updated_fields: Object.keys(updateData) },
    });

    res.status(200).json({
      school: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        logo_url: updated.logoUrl,
        address: updated.address,
        phone: updated.phone,
        email: updated.email,
        website: updated.website,
        status: updated.status,
        plan: updated.plan,
        monthly_fee: updated.monthlyFee,
        created_by: updated.createdBy,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update school error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteSchool(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.school.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('School not found', 404);
    }

    await prisma.membership.deleteMany({ where: { schoolId: id } });
    await prisma.userRole.deleteMany({ where: { schoolId: id } });
    await prisma.school.delete({ where: { id } });

    await logAuditEvent({
      action: 'delete_school',
      entityType: 'school',
      entityId: id,
      userId: req.user?.userId,
      details: { name: existing.name, slug: existing.slug },
    });

    res.status(200).json({ message: 'School deleted successfully' });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Delete school error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateSchoolStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      throw new AppError('Status is required', 400);
    }

    const existing = await prisma.school.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('School not found', 404);
    }

    const updated = await prisma.school.update({
      where: { id },
      data: { status },
    });

    await logAuditEvent({
      action: 'update_school_status',
      entityType: 'school',
      entityId: id,
      userId: req.user?.userId,
      schoolId: id,
      details: { old_status: existing.status, new_status: status },
    });

    res.status(200).json({
      school: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        updated_at: updated.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update school status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getSchoolDashboard(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) {
      throw new AppError('School not found', 404);
    }

    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      totalCourses,
      recentStudents,
      recentTeachers,
      teachersCount,
      studentsCount,
    ] = await Promise.all([
      prisma.student.count({ where: { schoolId: id } }),
      prisma.teacher.count({ where: { schoolId: id } }),
      prisma.class.count({ where: { schoolId: id } }),
      prisma.course.count({ where: { schoolId: id } }),
      prisma.student.findMany({
        where: { schoolId: id },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
      }),
      prisma.teacher.findMany({
        where: { schoolId: id },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: {
            select: { id: true, fullName: true, email: true, avatarUrl: true },
          },
        },
      }),
      prisma.userRole.count({
        where: { schoolId: id, role: 'teacher' },
      }),
      prisma.userRole.count({
        where: { schoolId: id, role: 'student' },
      }),
    ]);

    const pendingInvoices = await prisma.invoice.count({
      where: { schoolId: id, status: 'pending' },
    });

    const totalRevenue = await prisma.invoice.aggregate({
      where: { schoolId: id, status: 'paid' },
      _sum: { amount: true },
    });

    res.status(200).json({
      school: {
        id: school.id,
        name: school.name,
        status: school.status,
        plan: school.plan,
      },
      stats: {
        total_students: totalStudents,
        total_teachers: totalTeachers,
        total_classes: totalClasses,
        total_courses: totalCourses,
        enrolled_students: studentsCount,
        enrolled_teachers: teachersCount,
        pending_invoices: pendingInvoices,
        total_revenue: totalRevenue._sum.amount || 0,
      },
      recent: {
        students: recentStudents.map((s) => ({
          id: s.id,
          enrollment_number: s.enrollmentNumber,
          grade: s.grade,
          full_name: s.profile?.fullName,
          email: s.profile?.email,
          avatar_url: s.profile?.avatarUrl,
          created_at: s.createdAt,
        })),
        teachers: recentTeachers.map((t) => ({
          id: t.id,
          employee_id: t.employeeId,
          department: t.department,
          full_name: t.profile?.fullName,
          email: t.profile?.email,
          avatar_url: t.profile?.avatarUrl,
          created_at: t.createdAt,
        })),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get school dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
