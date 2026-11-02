import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { logAuditEvent } from '../utils/auditLog.js';

const router = Router();

const updateSettingSchema = z.object({
  value: z.any(),
  description: z.string().optional(),
});

function parseSettingValue(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

router.get('/public', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.platformSetting.findMany({
      where: { key: 'login_page' },
    });
    const loginPage = settings.length > 0 ? parseSettingValue(settings[0].value) : null;
    res.json({ data: loginPage });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get public settings' });
  }
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const roles = await prisma.userRole.findMany({ where: { userId: req.user!.userId } });
    const isSuperAdmin = roles.some((r) => r.role === 'super_admin');

    const settings = await prisma.platformSetting.findMany({
      orderBy: { key: 'asc' },
    });
    const normalized = settings.map((s) => ({
      ...s,
      value: parseSettingValue(s.value),
    }));

    if (!isSuperAdmin) {
      const sanitized = normalized.map((s) => ({
        id: s.id,
        key: s.key,
        value: s.key.includes('secret') || s.key.includes('password') ? '***' : s.value,
        description: s.description,
      }));
      res.json({ data: sanitized });
      return;
    }

    res.json({ data: normalized });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

router.put('/:key', requireAuth, validate(updateSettingSchema), async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;

    const roles = await prisma.userRole.findMany({ where: { userId: req.user!.userId } });
    const isSuperAdmin = roles.some((r) => r.role === 'super_admin');

    if (!isSuperAdmin) {
      throw new AppError('Only super admins can update platform settings', 403);
    }

    const existing = await prisma.platformSetting.findFirst({ where: { key } });
    const serializedValue = JSON.stringify(value);
    const setting = existing
      ? await prisma.platformSetting.update({
          where: { id: existing.id },
          data: {
            value: serializedValue,
            ...(description !== undefined && { description }),
            updatedBy: req.user!.userId,
          },
        })
      : await prisma.platformSetting.create({
          data: {
        key,
        value: serializedValue,
        description,
        updatedBy: req.user!.userId,
            createdAt: new Date(),
          },
        });

    await logAuditEvent({
      action: 'UPDATE',
      entityType: 'PlatformSetting',
      entityId: setting.id,
      entityName: key,
      userId: req.user!.userId,
      details: { key },
    });

    res.json({ data: setting });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
