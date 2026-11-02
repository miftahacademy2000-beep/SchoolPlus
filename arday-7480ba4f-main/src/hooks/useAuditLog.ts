import { api } from '@/lib/api';
import { useCallback } from 'react';

type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'password_change'
  | 'enroll'
  | 'unenroll'
  | 'assign'
  | 'unassign'
  | 'activate'
  | 'deactivate'
  | 'upload'
  | 'download';

type EntityType =
  | 'user'
  | 'student'
  | 'teacher'
  | 'parent'
  | 'school'
  | 'class'
  | 'course'
  | 'assignment'
  | 'grade'
  | 'attendance'
  | 'invoice'
  | 'timetable'
  | 'material';

interface LogAuditParams {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  schoolId?: string | null;
  details?: Record<string, unknown>;
}

export function useAuditLog() {
  const logAudit = useCallback(async (params: LogAuditParams) => {
    try {
      await api.post('/audit-logs', {
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId || null,
        entity_name: params.entityName || null,
        school_id: params.schoolId || null,
        details: params.details || {},
      });
    } catch (err) {
      console.error('Error logging audit event:', err);
    }
  }, []);

  return { logAudit };
}

export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    await api.post('/audit-logs', {
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      entity_name: params.entityName || null,
      school_id: params.schoolId || null,
      details: params.details || {},
    });
  } catch (err) {
    console.error('Error logging audit event:', err);
  }
}
