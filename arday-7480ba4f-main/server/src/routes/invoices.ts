import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, requireSchoolAccess } from '../middleware/schoolAccess.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';
import { generateInvoiceNumber } from '../utils/invoiceNumber.js';
import { amountToCents, availableRefundCents, outstandingBalanceCents } from '../utils/invoiceFinancials.js';

const router = Router();

const createInvoiceSchema = z.object({
  student_id: z.string().min(1),
  school_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().min(0),
  due_date: z.string().min(1),
  status: z.enum(['pending', 'overdue']).optional(),
});

const updateInvoiceSchema = z.object({
  school_id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  amount: z.number().min(0).optional(),
  due_date: z.string().optional(),
  student_id: z.string().min(1).optional(),
  payment_method: z.string().optional(),
});

const updateStatusSchema = z.object({
  school_id: z.string().min(1),
  status: z.enum(['pending', 'overdue']),
});

const recordPaymentSchema = z.object({
  school_id: z.string().min(1),
  amount: z.number().min(0.01),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
});

const cancelInvoiceSchema = z.object({
  school_id: z.string().min(1),
  cancellation_type: z.enum(['refund_issued', 'fee_waived', 'created_in_error']),
  reason: z.string().trim().min(1).max(4000),
  note: z.string().max(4000).optional(),
  amount: z.number().positive().finite().optional(),
  payment_history_id: z.string().min(1).optional(),
  refund_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  refund_confirmed: z.literal(true).optional(),
  duplicate: z.boolean().optional(),
  related_invoice_id: z.string().min(1).optional(),
}).superRefine((data, context) => {
  if (data.cancellation_type === 'fee_waived' && data.amount === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'Waiver amount is required' });
  }

  if (data.cancellation_type === 'refund_issued') {
    if (data.amount === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'Refund amount is required' });
    }
    if (!data.payment_history_id) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_history_id'], message: 'Original payment is required' });
    }
    if (!data.refund_date) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['refund_date'], message: 'Refund date is required' });
    }
    if (data.refund_confirmed !== true) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['refund_confirmed'], message: 'Confirm that the refund was processed' });
    }
    if (data.refund_date) {
      const parsedDate = new Date(`${data.refund_date}T00:00:00.000Z`);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== data.refund_date) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['refund_date'], message: 'Enter a valid refund processing date' });
      }
    }
  }

  if (data.cancellation_type === 'created_in_error' && data.duplicate && !data.related_invoice_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['related_invoice_id'], message: 'Select the original invoice for a duplicate' });
  }
  if (data.cancellation_type === 'created_in_error' && !data.duplicate && data.related_invoice_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['related_invoice_id'], message: 'Mark this invoice as a duplicate before linking an original' });
  }
});

const recordRefundSchema = z.object({
  school_id: z.string().min(1),
  payment_history_id: z.string().min(1),
  amount: z.number().min(0.01).finite(),
  refund_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1).max(4000),
  note: z.string().max(4000).optional(),
  refund_confirmed: z.literal(true),
}).superRefine((data, context) => {
  const parsedDate = new Date(`${data.refund_date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== data.refund_date) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['refund_date'], message: 'Enter a valid refund processing date' });
  }
});

const generateMonthlySchema = z.object({
  school_id: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  title: z.string().optional(),
  description: z.string().optional(),
});

const createTemplateSchema = z.object({
  school_id: z.string().min(1),
  name: z.string().min(1),
  layout: z.any(),
  is_default: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  layout: z.any().optional(),
  is_default: z.boolean().optional(),
});

router.get('/', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const schoolId = req.query.school_id as string;
    const studentId = req.query.student_id as string;
    const status = req.query.status as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      student: { archived_at: null },
    };
    if (schoolId) where.schoolId = schoolId;
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) (where.dueDate as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.dueDate as Record<string, unknown>).lte = new Date(endDate);
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          student: { include: { profile: true } },
          refunds: { where: { status: 'processed' }, select: { amount: true } },
          cancellationAuthor: { select: { fullName: true } },
          relatedInvoice: { select: { id: true, invoiceNumber: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    const data = invoices.map(({ refunds, ...invoice }) => ({
      ...invoice,
      amountRefunded: refunds.reduce((sum, refund) => sum + Number(refund.amount), 0),
    }));
    res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list invoices' });
  }
});

router.get('/templates', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const schoolId = req.query.school_id as string;

    const templates = await prisma.invoiceTemplate.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: templates });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

router.get('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        student: { include: { profile: true } },
        paymentHistory: { include: { recorder: true } },
        refunds: {
          where: { status: 'processed' },
          include: {
            payment: true,
            recorder: { select: { fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        cancellationAuthor: { select: { fullName: true } },
        relatedInvoice: { select: { id: true, invoiceNumber: true } },
      },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    if (req.query.school_id !== invoice.schoolId) {
      throw new AppError('You do not have access to this invoice', 403);
    }

    res.json({
      data: {
        ...invoice,
        amountRefunded: invoice.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get invoice' });
  }
});

router.get('/:id/payments', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    if (req.query.school_id !== invoice.schoolId) {
      throw new AppError('You do not have access to this invoice', 403);
    }

    const payments = await prisma.paymentHistory.findMany({
      where: { invoiceId: id },
      include: { recorder: true },
      orderBy: { createdAt: 'desc' },
    });

    const refundTotals = payments.length
      ? await prisma.invoiceRefund.groupBy({
          by: ['paymentHistoryId'],
          where: { paymentHistoryId: { in: payments.map((payment) => payment.id) }, status: 'processed' },
          _sum: { amount: true },
        })
      : [];
    const refundedByPayment = new Map(refundTotals.map((refund) => [
      refund.paymentHistoryId,
      Number(refund._sum.amount || 0),
    ]));

    res.json({
      data: payments.map((payment) => ({
        ...payment,
        amountRefunded: refundedByPayment.get(payment.id) || 0,
      })),
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

router.get('/:id/refunds', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    if (req.query.school_id !== invoice.schoolId) {
      throw new AppError('You do not have access to this invoice', 403);
    }

    const refunds = await prisma.invoiceRefund.findMany({
      where: { invoiceId: id, status: 'processed' },
      include: {
        payment: { select: { id: true, amount: true, createdAt: true } },
        recorder: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: refunds });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to list invoice refunds' });
  }
});

router.post('/', requireAuth, requireSchoolAccess, validate(createInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const { student_id, school_id, title, description, amount, due_date, status } = req.body;

    const school = await prisma.school.findUnique({
      where: { id: school_id },
      select: { currency: true },
    });
    if (!school) {
      throw new AppError('School not found', 404);
    }

    const student = await prisma.student.findFirst({
      where: { id: student_id, schoolId: school_id, archived_at: null },
      select: { id: true },
    });
    if (!student) {
      throw new AppError('Student not found or is archived', 404);
    }

    const invoiceNumber = await generateInvoiceNumber(school_id);

    const invoice = await prisma.invoice.create({
      data: {
        studentId: student_id,
        schoolId: school_id,
        invoiceNumber,
        title,
        description,
        amount,
        dueDate: new Date(due_date),
        status: status ?? 'pending',
        amountPaid: 0,
        currency: school.currency,
        createdAt: new Date(),
      },
      include: {
        student: { include: { profile: true } },
      },
    });

    await logAuditEvent({
      action: 'CREATE',
      entityType: 'Invoice',
      entityId: invoice.id,
      entityName: invoiceNumber,
      schoolId: school_id,
      userId: req.user!.userId,
    });

    res.status(201).json({ data: invoice });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.put('/:id', requireAuth, requireSchoolAccess, validate(updateInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { school_id, title, description, amount, due_date, student_id, payment_method } = req.body;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Invoice not found', 404);
    }
    if (existing.schoolId !== school_id) {
      throw new AppError('You do not have access to this invoice', 403);
    }
    if (existing.status === 'cancelled') {
      throw new AppError('Cancelled invoices cannot be edited', 409);
    }
    const paymentCount = await prisma.paymentHistory.count({ where: { invoiceId: id } });
    if (amount !== undefined && (Number(existing.amountPaid) > 0 || paymentCount > 0) && amountToCents(amount) !== amountToCents(Number(existing.amount))) {
      throw new AppError('The original amount cannot be changed after payments are recorded', 409);
    }
    if (student_id !== undefined && student_id !== existing.studentId) {
      if (paymentCount > 0) {
        throw new AppError('The student cannot be changed after payments are recorded', 409);
      }
      const student = await prisma.student.findFirst({
        where: { id: student_id, schoolId: school_id, archived_at: null },
        select: { id: true },
      });
      if (!student) {
        throw new AppError('Student not found or is archived in this school', 404);
      }
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(amount !== undefined && { amount }),
        ...(due_date !== undefined && { dueDate: new Date(due_date) }),
        ...(student_id !== undefined && { studentId: student_id }),
        ...(payment_method !== undefined && { paymentMethod: payment_method }),
      },
      include: { student: { include: { profile: true } } },
    });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'Invoice',
      entityId: invoice.id,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: invoice });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

router.put('/:id/status', requireAuth, requireSchoolAccess, validate(updateStatusSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { school_id, status } = req.body;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Invoice not found', 404);
    }
    if (existing.schoolId !== school_id) {
      throw new AppError('You do not have access to this invoice', 403);
    }
    if (existing.status === 'cancelled') {
      throw new AppError('Cancelled invoices cannot be reopened or marked paid', 409);
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status,
        ...(status === 'paid' && { paidDate: new Date() }),
      },
    });

    await logAuditEvent({
      action: 'UPDATE_STATUS',
      entityType: 'Invoice',
      entityId: invoice.id,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
      details: { status },
    });

    res.json({ data: invoice });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.post('/:id/cancel', requireAuth, requireRole('school_admin', 'super_admin'), requireSchoolAccess, validate(cancelInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      school_id,
      cancellation_type,
      reason,
      note,
      amount,
      payment_history_id,
      refund_date,
      duplicate,
      related_invoice_id,
    } = req.body;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Invoice not found', 404);
    }
    if (existing.schoolId !== school_id) {
      throw new AppError('You do not have access to this invoice', 403);
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM invoices WHERE id = ${id} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice || invoice.schoolId !== school_id) {
        throw new AppError('Invoice not found', 404);
      }
      if (invoice.status === 'cancelled') {
        throw new AppError('This invoice has already been cancelled', 409);
      }

      let refund = null;
      let amountWaived = Number(invoice.amountWaived);
      let relatedInvoiceId: string | null = null;

      if (cancellation_type === 'fee_waived') {
        const waiverCents = amountToCents(amount!);
        const outstandingCents = outstandingBalanceCents(
          Number(invoice.amount),
          Number(invoice.amountPaid),
          Number(invoice.amountWaived),
        );
        if (waiverCents > outstandingCents) {
          throw new AppError('Waiver amount exceeds the outstanding balance', 400);
        }
        amountWaived = (amountToCents(amountWaived) + waiverCents) / 100;
      }

      if (cancellation_type === 'refund_issued') {
        const payment = await tx.paymentHistory.findUnique({ where: { id: payment_history_id! } });
        if (!payment || payment.invoiceId !== id || payment.school_id !== school_id) {
          throw new AppError('Original payment not found for this invoice', 404);
        }

        const priorRefunds = await tx.invoiceRefund.aggregate({
          where: { paymentHistoryId: payment.id, status: 'processed' },
          _sum: { amount: true },
        });
        const refundableCents = availableRefundCents(
          Number(payment.amount),
          Number(priorRefunds._sum.amount || 0),
        );
        const refundCents = amountToCents(amount!);
        if (refundCents > refundableCents) {
          throw new AppError('Refund amount exceeds the payment amount remaining to refund', 400);
        }

        refund = await tx.invoiceRefund.create({
          data: {
            invoiceId: id,
            paymentHistoryId: payment.id,
            amount: refundCents / 100,
            refundDate: new Date(`${refund_date}T00:00:00.000Z`),
            reason,
            note: note || null,
            status: 'processed',
            recordedBy: req.user!.userId,
            schoolId: school_id,
            createdAt: new Date(),
          },
        });
      }

      if (cancellation_type === 'created_in_error' && duplicate && related_invoice_id) {
        const originalInvoice = await tx.invoice.findFirst({
          where: { id: related_invoice_id, schoolId: school_id },
          select: { id: true },
        });
        if (!originalInvoice || originalInvoice.id === id) {
          throw new AppError('Select a different original invoice from this school', 400);
        }
        relatedInvoiceId = originalInvoice.id;
      }

      const cancelledInvoice = await tx.invoice.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancellationType: cancellation_type,
          cancellationReason: reason,
          cancellationNote: note || null,
          amountWaived,
          cancelledAt: new Date(),
          cancelledBy: req.user!.userId,
          relatedInvoiceId,
        },
        include: {
          cancellationAuthor: { select: { fullName: true } },
          relatedInvoice: { select: { id: true, invoiceNumber: true } },
        },
      });

      return { invoice: cancelledInvoice, refund };
    });

    await logAuditEvent({
      action: 'CANCEL',
      entityType: 'Invoice',
      entityId: result.invoice.id,
      entityName: result.invoice.invoiceNumber,
      schoolId: school_id,
      userId: req.user!.userId,
      details: {
        cancellationType: cancellation_type,
        reason,
        note: note || null,
        amountRefunded: result.refund ? Number(result.refund.amount) : 0,
        amountWaived: Number(result.invoice.amountWaived),
        refundId: result.refund?.id || null,
        paymentHistoryId: result.refund?.paymentHistoryId || null,
        relatedInvoiceId: result.invoice.relatedInvoiceId,
      },
    });

    res.json({ data: result.invoice, refund: result.refund });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to cancel invoice' });
  }
});

router.post('/:id/refunds', requireAuth, requireRole('school_admin', 'super_admin'), requireSchoolAccess, validate(recordRefundSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { school_id, payment_history_id, amount, refund_date, reason, note } = req.body;
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing || existing.schoolId !== school_id) {
      throw new AppError('Invoice not found', 404);
    }
    if (existing.status !== 'cancelled' || existing.cancellationType !== 'refund_issued') {
      throw new AppError('Additional refunds can only be recorded for invoices cancelled as Refund Issued', 409);
    }

    const refund = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM invoices WHERE id = ${id} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice || invoice.schoolId !== school_id) {
        throw new AppError('Invoice not found', 404);
      }
      if (invoice.status !== 'cancelled' || invoice.cancellationType !== 'refund_issued') {
        throw new AppError('Additional refunds can only be recorded for invoices cancelled as Refund Issued', 409);
      }

      const payment = await tx.paymentHistory.findUnique({ where: { id: payment_history_id } });
      if (!payment || payment.invoiceId !== id || payment.school_id !== school_id) {
        throw new AppError('Original payment not found for this invoice', 404);
      }
      const priorRefunds = await tx.invoiceRefund.aggregate({
        where: { paymentHistoryId: payment.id, status: 'processed' },
        _sum: { amount: true },
      });
      const refundCents = amountToCents(amount);
      const refundableCents = availableRefundCents(
        Number(payment.amount),
        Number(priorRefunds._sum.amount || 0),
      );
      if (refundCents > refundableCents) {
        throw new AppError('Refund amount exceeds the payment amount remaining to refund', 400);
      }

      return tx.invoiceRefund.create({
        data: {
          invoiceId: id,
          paymentHistoryId: payment.id,
          amount: refundCents / 100,
          refundDate: new Date(`${refund_date}T00:00:00.000Z`),
          reason,
          note: note || null,
          status: 'processed',
          recordedBy: req.user!.userId,
          schoolId: school_id,
          createdAt: new Date(),
        },
      });
    });

    await logAuditEvent({
      action: 'REFUND',
      entityType: 'InvoiceRefund',
      entityId: refund.id,
      entityName: existing.invoiceNumber,
      schoolId: school_id,
      userId: req.user!.userId,
      details: {
        invoiceId: id,
        paymentHistoryId: payment_history_id,
        amount: Number(refund.amount),
        refundDate: refund_date,
        reason,
        note: note || null,
      },
    });

    res.status(201).json({ data: refund });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to record refund' });
  }
});

router.post('/:id/payments', requireAuth, requireSchoolAccess, validate(recordPaymentSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { school_id, amount, payment_method, notes } = req.body;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Invoice not found', 404);
    }
    if (existing.schoolId !== school_id) {
      throw new AppError('You do not have access to this invoice', 403);
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM invoices WHERE id = ${id} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice || invoice.schoolId !== school_id) {
        throw new AppError('Invoice not found', 404);
      }
      if (invoice.status === 'cancelled' && invoice.cancellationType !== 'fee_waived') {
        throw new AppError('Payments cannot be recorded on a cancelled invoice', 409);
      }
      const amountCents = amountToCents(amount);
      const remainingCents = outstandingBalanceCents(
        Number(invoice.amount),
        Number(invoice.amountPaid),
        Number(invoice.amountWaived),
      );
      if (amountCents > remainingCents) {
        throw new AppError('Payment amount exceeds the outstanding balance', 400);
      }

      const payment = await tx.paymentHistory.create({
        data: {
          invoiceId: id,
          amount: amountCents / 100,
          paymentMethod: payment_method,
          notes,
          recordedBy: req.user!.userId,
          school_id,
          reconciled: false,
          createdAt: new Date(),
        },
      });

      const newAmountPaid = (amountToCents(Number(invoice.amountPaid)) + amountCents) / 100;
      const newStatus = invoice.status === 'cancelled'
        ? 'cancelled'
        : outstandingBalanceCents(
            Number(invoice.amount),
            newAmountPaid,
            Number(invoice.amountWaived),
          ) === 0 ? 'paid' : invoice.status;

      await tx.invoice.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
          ...(newStatus === 'paid' && { paidDate: new Date() }),
        },
      });

      return payment;
    });

    await logAuditEvent({
      action: 'RECORD_PAYMENT',
      entityType: 'PaymentHistory',
      entityId: result.id,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
      details: { invoiceId: id, amount: amountToCents(amount) / 100, paymentMethod: payment_method },
    });

    res.status(201).json({ data: result });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

router.delete('/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Invoice not found', 404);
    }
    if (req.query.school_id !== existing.schoolId) {
      throw new AppError('You do not have access to this invoice', 403);
    }
    if (existing.status === 'cancelled') {
      throw new AppError('Cancelled invoices are retained as financial history and cannot be deleted', 409);
    }
    const paymentCount = await prisma.paymentHistory.count({ where: { invoiceId: id } });
    if (paymentCount > 0) {
      throw new AppError('Invoices with payment history cannot be deleted; cancel the invoice instead', 409);
    }

    // Check permission: Super Admin can delete any invoice;
    // School Admin can only delete invoices from their own school
    const userRoles = await prisma.userRole.findMany({
      where: { userId: req.user!.userId },
      select: { role: true, schoolId: true },
    });

    const isSuperAdmin = userRoles.some((r) => r.role === 'super_admin');
    const isSchoolAdmin = userRoles.some((r) => r.role === 'school_admin');
    const userSchoolId = userRoles.find((r) => r.role === 'school_admin')?.schoolId || null;

    // School Admin must only be able to delete invoices from their own school
    if (isSchoolAdmin && existing.schoolId !== userSchoolId) {
      throw new AppError('You do not have permission to delete this invoice', 403);
    }

    // School Admin with access: proceed with deletion
    // (Super Admin bypasses school isolation)

    await prisma.$transaction(async (tx) => {
      await tx.paymentHistory.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    await logAuditEvent({
      action: 'DELETE',
      entityType: 'Invoice',
      entityId: id,
      entityName: existing.invoiceNumber,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Invoice deleted successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

router.post('/generate-monthly', requireAuth, requireSchoolAccess, validate(generateMonthlySchema), async (req: Request, res: Response) => {
  try {
    const { school_id, month, year, title, description } = req.body;

    const school = await prisma.school.findUnique({
      where: { id: school_id },
      select: { currency: true, monthlyFee: true },
    });
    if (!school) {
      throw new AppError('School not found', 404);
    }

    const students = await prisma.student.findMany({
      where: { schoolId: school_id, archived_at: null },
      include: {
        classStudents: { include: { class: { include: { class_fees: true } } } },
      },
    });

    if (students.length === 0) {
      throw new AppError('No students found for this school', 400);
    }

    const invoices = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const student of students) {
        const monthlyFee =
          student.classStudents[0]?.class?.class_fees[0]?.monthly_fee ?? school.monthlyFee;
        if (!monthlyFee || Number(monthlyFee) <= 0) continue;

        const existingInvoice = await tx.invoice.findFirst({
          where: {
            studentId: student.id,
            schoolId: school_id,
            title: title ?? `Monthly Fee - ${month}/${year}`,
          },
        });
        if (existingInvoice) continue;

        const invoiceNumber = await generateInvoiceNumber(school_id);
        const invoice = await tx.invoice.create({
          data: {
            studentId: student.id,
            schoolId: school_id,
            invoiceNumber,
            title: title ?? `Monthly Fee - ${month}/${year}`,
            description,
            amount: monthlyFee,
            dueDate: new Date(year, month, 0),
            status: 'pending',
            amountPaid: 0,
            currency: school.currency,
            createdAt: new Date(),
          },
        });
        results.push(invoice);
      }
      return results;
    });

    await logAuditEvent({
      action: 'GENERATE_MONTHLY',
      entityType: 'Invoice',
      schoolId: school_id,
      userId: req.user!.userId,
      details: { month, year, count: invoices.length },
    });

    res.status(201).json({ data: { count: invoices.length, invoices } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to generate monthly invoices' });
  }
});

router.post('/update-overdue', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const now = new Date();

    const result = await prisma.invoice.updateMany({
      where: {
        status: 'pending',
        dueDate: { lt: now },
      },
      data: {
        status: 'overdue',
      },
    });

    await logAuditEvent({
      action: 'UPDATE_OVERDUE',
      entityType: 'Invoice',
      userId: req.user!.userId,
      details: { count: result.count },
    });

    res.json({ data: { count: result.count, message: 'Overdue invoices updated' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update overdue invoices' });
  }
});

router.post('/templates', requireAuth, requireSchoolAccess, validate(createTemplateSchema), async (req: Request, res: Response) => {
  try {
    const { school_id, name, layout, is_default } = req.body;

    if (is_default) {
      await prisma.invoiceTemplate.updateMany({
        where: { schoolId: school_id },
        data: { isDefault: false },
      });
    }

    const template = await prisma.invoiceTemplate.create({
      data: {
        schoolId: school_id,
        name,
        layout,
        isDefault: is_default ?? false,
        createdAt: new Date(),
      },
    });

    await logAuditEvent({
      action: 'CREATE',
      entityType: 'InvoiceTemplate',
      entityId: template.id,
      entityName: name,
      schoolId: school_id,
      userId: req.user!.userId,
    });

    res.status(201).json({ data: template });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.put('/templates/:id', requireAuth, requireSchoolAccess, validate(updateTemplateSchema), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, layout, is_default } = req.body;

    const existing = await prisma.invoiceTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Template not found', 404);
    }

    if (is_default) {
      await prisma.invoiceTemplate.updateMany({
        where: { schoolId: existing.schoolId, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const template = await prisma.invoiceTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(layout !== undefined && { layout }),
        ...(is_default !== undefined && { isDefault: is_default }),
      },
    });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'InvoiceTemplate',
      entityId: template.id,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: template });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/templates/:id', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.invoiceTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Template not found', 404);
    }

    await prisma.invoiceTemplate.delete({ where: { id } });

    await logAuditEvent({
      action: 'DELETE',
      entityType: 'InvoiceTemplate',
      entityId: id,
      entityName: existing.name,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Template deleted successfully' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

router.put('/templates/:id/default', requireAuth, requireSchoolAccess, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.invoiceTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Template not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoiceTemplate.updateMany({
        where: { schoolId: existing.schoolId },
        data: { isDefault: false },
      });
      await tx.invoiceTemplate.update({
        where: { id },
        data: { isDefault: true },
      });
    });

    await logAuditEvent({
      action: 'SET_DEFAULT',
      entityType: 'InvoiceTemplate',
      entityId: id,
      schoolId: existing.schoolId,
      userId: req.user!.userId,
    });

    res.json({ data: { message: 'Template set as default' } });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to set default template' });
  }
});

export default router;
