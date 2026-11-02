import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useTeachers } from './useTeachers';

export interface ClassTeacherWithProfile {
  id: string;
  teacher_id: string;
  role: string;
  profile: { full_name: string | null } | null;
  department: string | null;
  employee_id: string | null;
}

export function useClassTeacherEnrollment(classId: string) {
  const { data: allTeachers } = useTeachers();

  const enrolledQuery = useQuery({
    queryKey: ['class-teachers', classId],
    queryFn: async (): Promise<ClassTeacherWithProfile[]> => {
      const { data } = await api.get<ClassTeacherWithProfile[]>(`/classes/${classId}/teachers`);
      return data || [];
    },
    enabled: !!classId,
  });

  const enrolledTeacherIds = new Set(
    (enrolledQuery.data || []).map((ct) => ct.teacher_id)
  );

  const availableTeachers = (allTeachers || []).filter(
    (t) => !enrolledTeacherIds.has(t.id)
  );

  return {
    enrolledTeachers: enrolledQuery.data || [],
    availableTeachers,
    isLoading: enrolledQuery.isLoading,
  };
}

export function useEnrollTeachers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      classId,
      teacherIds,
      role = 'assistant',
    }: {
      classId: string;
      teacherIds: string[];
      role?: string;
    }) => {
      await api.post(`/classes/${classId}/teachers`, { teacher_ids: teacherIds, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-teachers'] });
      toast({ title: 'Teachers enrolled', description: 'Teachers have been added to the class.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error enrolling teachers', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUnenrollTeacher() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ classId, teacherId }: { classId: string; teacherId: string }) => {
      await api.delete(`/classes/${classId}/teachers/${teacherId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-teachers'] });
      toast({ title: 'Teacher removed', description: 'Teacher has been removed from the class.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error removing teacher', description: error.message, variant: 'destructive' });
    },
  });
}
