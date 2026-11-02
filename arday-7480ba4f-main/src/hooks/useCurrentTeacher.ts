import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface CurrentTeacher {
  id: string;
  user_id: string;
  school_id: string;
  department: string | null;
  employee_id: string | null;
  subjects: string[] | null;
}

export function useCurrentTeacher() {
  const { user, primaryRole } = useAuth();

  return useQuery({
    queryKey: ['current-teacher', user?.id],
    queryFn: async (): Promise<CurrentTeacher | null> => {
      if (!user?.id) return null;
      const { data } = await api.get<CurrentTeacher>('/teachers/portal');
      return data || null;
    },
    enabled: !!user?.id && primaryRole === 'teacher',
  });
}
