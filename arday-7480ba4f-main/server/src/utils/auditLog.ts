import { prisma } from '../config/database.js';

export interface AuditLogParams {
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  schoolId?: string;
  userId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  const {
    action,
    entityType,
    entityId,
    entityName,
    schoolId,
    userId,
    details,
    ipAddress,
    userAgent,
  } = params;

  let userName: string | null = null;
  let userEmail: string | null = null;

  if (userId) {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true },
    });

    if (profile) {
      userName = profile.fullName ?? null;
      userEmail = profile.email ?? null;
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      userEmail,
      userName,
      action,
      entityType,
      entityId: entityId ?? null,
      entityName: entityName ?? null,
      schoolId: schoolId ?? null,
      details: JSON.stringify(details ?? {}),
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      createdAt: new Date(),
    },
  });
}
