import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const createInquirySchema = z.object({
  school_name: z.string().min(1),
  contact_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  message: z.string().optional(),
});

const updateInquirySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  admin_notes: z.string().optional(),
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const roles = await prisma.userRole.findMany({ where: { userId: req.user!.userId } });
    const isSuperAdmin = roles.some((r) => r.role === 'super_admin');

    if (!isSuperAdmin) {
      throw new AppError('Only super admins can list inquiries', 403);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [inquiries, total] = await Promise.all([
      prisma.schoolInquiry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.schoolInquiry.count({ where }),
    ]);

    res.json({ data: inquiries, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list inquiries' });
  }
});

router.post('/', validate(createInquirySchema), async (req: Request, res: Response) => {
  try {
    const { school_name, contact_name, email, phone, address, message } = req.body;

    const inquiry = await prisma.schoolInquiry.create({
      data: {
        schoolName: school_name,
        contactName: contact_name,
        email,
        phone: phone ? BigInt(phone) : null,
        address,
        message,
        status: 'pending',
        createdAt: new Date(),
      },
    });

    res.status(201).json({ data: inquiry });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create inquiry' });
  }
});

router.put('/:id', requireAuth, validate(updateInquirySchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const roles = await prisma.userRole.findMany({ where: { userId: req.user!.userId } });
    const isSuperAdmin = roles.some((r) => r.role === 'super_admin');

    if (!isSuperAdmin) {
      throw new AppError('Only super admins can update inquiries', 403);
    }

    const existing = await prisma.schoolInquiry.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Inquiry not found', 404);
    }

    const inquiry = await prisma.schoolInquiry.update({
      where: { id },
      data: {
        status,
        ...(admin_notes !== undefined && { adminNotes: admin_notes }),
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
      },
    });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'SchoolInquiry',
      entityId: inquiry.id,
      entityName: inquiry.schoolName,
      userId: req.user!.userId,
      details: { status },
    });

    res.json({ data: inquiry });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update inquiry' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const roles = await prisma.userRole.findMany({ where: { userId: req.user!.userId } });
    const isSuperAdmin = roles.some((r) => r.role === 'super_admin');

    if (!isSuperAdmin) {
      throw new AppError('Only super admins can delete inquiries', 403);
    }

    const existing = await prisma.schoolInquiry.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Inquiry not found', 404);
    }

    await prisma.schoolInquiry.delete({ where: { id } });

    await logAuditEvent({
      action: 'DELETE',
      entityType: 'SchoolInquiry',
      entityId: id,
      entityName: existing.schoolName,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Inquiry deleted successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete inquiry' });
  }
});

export default router;
