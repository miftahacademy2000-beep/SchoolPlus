import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from './useSchoolContext';

export interface TeacherWithProfile {
  id: string;
  user_id: string;
  school_id: string;
  employee_id: string | null;
  department: string | null;
  subjects: string[] | null;
  created_at: string;
  profile: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
}

export function useTeachers() {
  const { currentSchoolId, isSuperAdmin } = useSchoolContext();

  return useQuery({
    queryKey: ['teachers', currentSchoolId],
    queryFn: async (): Promise<TeacherWithProfile[]> => {
      const params = new URLSearchParams();
      if (!isSuperAdmin && currentSchoolId) {
        params.set('school_id', currentSchoolId);
      }
      const qs = params.toString();
      const { data } = await api.get<TeacherWithProfile[]>(`/teachers${qs ? `?${qs}` : ''}`);
      return data || [];
    },
    enabled: !!currentSchoolId || isSuperAdmin,
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentSchoolId } = useSchoolContext();

  return useMutation({
    mutationFn: async (data: {
      user_id: string;
      school_id?: string;
      employee_id?: string;
      department?: string;
      subjects?: string[];
    }) => {
      await api.post('/teachers', {
        user_id: data.user_id,
        school_id: data.school_id || currentSchoolId,
        employee_id: data.employee_id || null,
        department: data.department || null,
        subjects: data.subjects || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast({
        title: 'Teacher added',
        description: 'The teacher has been added successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error adding teacher',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      user_id?: string;
      full_name?: string;
      email?: string;
      employee_id?: string;
      department?: string;
      subjects?: string[];
    }) => {
      await api.put(`/teachers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast({
        title: 'Teacher updated',
        description: 'The teacher has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating teacher',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export { useArchiveUser as useDeleteTeacher } from './useArchivedUsers';
