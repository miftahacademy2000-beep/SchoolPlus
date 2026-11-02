import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from './useSchoolContext';

export type GradeType = 'assignment' | 'quiz' | 'exam' | 'project' | 'participation';

export interface GradeRecord {
  id: string;
  student_id: string;
  course_id: string;
  grade_type: GradeType;
  title: string;
  score: number;
  max_score: number;
  weight: number | null;
  graded_by: string | null;
  graded_at: string;
  notes: string | null;
  created_at: string;
  student?: {
    id: string;
    profile: {
      full_name: string | null;
    } | null;
  } | null;
  course?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export function useGrades(courseId?: string, studentId?: string) {
  const { currentSchoolId, isSuperAdmin } = useSchoolContext();

  return useQuery({
    queryKey: ['grades', courseId, studentId, currentSchoolId],
    queryFn: async (): Promise<GradeRecord[]> => {
      const params = new URLSearchParams();
      if (currentSchoolId) params.set('school_id', currentSchoolId);
      if (courseId) params.set('course_id', courseId);
      if (studentId) params.set('student_id', studentId);
      const qs = params.toString();
      const { data } = await api.get<GradeRecord[]>(`/grades${qs ? `?${qs}` : ''}`);
      return data || [];
    },
    enabled: !!currentSchoolId || isSuperAdmin,
  });
}

export function useCourses() {
  const { currentSchoolId, isSuperAdmin } = useSchoolContext();

  return useQuery({
    queryKey: ['courses', currentSchoolId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentSchoolId) params.set('school_id', currentSchoolId);
      const qs = params.toString();
      const { data } = await api.get<any[]>(`/courses${qs ? `?${qs}` : ''}`);
      return data || [];
    },
    enabled: !!currentSchoolId || isSuperAdmin,
  });
}

export function useCreateGrade() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      student_id: string;
      course_id: string;
      grade_type: GradeType;
      title: string;
      score: number;
      max_score?: number;
      weight?: number;
      graded_by?: string;
      notes?: string;
    }) => {
      await api.post('/grades', {
        student_id: data.student_id,
        course_id: data.course_id,
        grade_type: data.grade_type,
        title: data.title,
        score: data.score,
        max_score: data.max_score || 100,
        weight: data.weight || 1.0,
        graded_by: data.graded_by || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast({
        title: 'Grade added',
        description: 'The grade has been added successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error adding grade',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateGrade() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      grade_type?: GradeType;
      title?: string;
      score?: number;
      max_score?: number;
      weight?: number;
      notes?: string;
    }) => {
      await api.put(`/grades/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast({
        title: 'Grade updated',
        description: 'The grade has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating grade',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteGrade() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/grades/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast({
        title: 'Grade deleted',
        description: 'The grade has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting grade',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
