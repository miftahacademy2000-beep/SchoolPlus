import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/stores/useAppStore';

/**
 * Hook to get the current user's school context
 * Returns the school_id for school admins, teachers, or students
 * Super admins can override the school context via the global store (sidebar switcher)
 */
export function useSchoolContext() {
  const { roles, isSuperAdmin } = useAuth();
  const overrideSchoolId = useAppStore((s) => s.currentSchoolId);
  const setOverrideSchoolId = useAppStore((s) => s.setCurrentSchoolId);

  // Get school_id from the first role that has one
  const schoolRole = roles.find(r => r.school_id !== null);
  const roleSchoolId = schoolRole?.school_id ?? null;

  // Super admins can override; otherwise use role-based school
  const currentSchoolId = (isSuperAdmin && overrideSchoolId) ? overrideSchoolId : roleSchoolId;

  return {
    currentSchoolId,
    isSuperAdmin,
    hasSchoolAccess: !!currentSchoolId || isSuperAdmin,
    overrideSchoolId,
    setOverrideSchoolId,
  };
}
