import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from './useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTeacher } from './useCurrentTeacher';

export interface Course {
  id: string;
  name: string;
  code: string;
  description: string | null;
  school_id: string;
  teacher_id: string | null;
  credits: number | null;
  created_at: string;
  updated_at: string;
  teacher?: {
    id: string;
    user_id: string;
    profile?: {
      full_name: string | null;
    } | null;
  } | null;
}

export function useCourses() {
  const { currentSchoolId, isSuperAdmin } = useSchoolContext();
  const { primaryRole } = useAuth();
  const { data: currentTeacher } = useCurrentTeacher();
  const isTeacher = primaryRole === 'teacher';

  return useQuery({
    queryKey: ['courses', currentSchoolId, isTeacher ? currentTeacher?.id : null],
    queryFn: async (): Promise<Course[]> => {
      const params = new URLSearchParams();
      if (currentSchoolId) params.set('school_id', currentSchoolId);
      const qs = params.toString();
      const { data } = await api.get<Course[]>(`/courses${qs ? `?${qs}` : ''}`);
      return data || [];
    },
    enabled: (!!currentSchoolId || isSuperAdmin) && (!isTeacher || !!currentTeacher),
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentSchoolId } = useSchoolContext();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      code: string;
      description?: string;
      teacher_id?: string;
      credits?: number;
    }) => {
      if (!currentSchoolId) {
        throw new Error('No school selected');
      }

      await api.post('/courses', {
        name: data.name,
        code: data.code,
        description: data.description || null,
        teacher_id: data.teacher_id || null,
        credits: data.credits || 3,
        school_id: currentSchoolId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast({
        title: 'Course created',
        description: 'The course has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating course',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      code?: string;
      description?: string | null;
      teacher_id?: string | null;
      credits?: number;
    }) => {
      await api.put(`/courses/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast({
        title: 'Course updated',
        description: 'The course has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating course',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/courses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast({
        title: 'Course deleted',
        description: 'The course has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting course',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
