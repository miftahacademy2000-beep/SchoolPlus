import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from './useSchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTeacher } from './useCurrentTeacher';

export interface ClassWithTeacher {
  id: string;
  name: string;
  grade: string | null;
  section: string | null;
  capacity: number | null;
  program?: string | null;
  level_label?: string | null;
  education_level?: string | null;
  school_id: string;
  teacher_id: string | null;
  monthly_fee: number | null;
  created_at: string;
  teacher?: {
    id: string;
    profile: {
      full_name: string | null;
    } | null;
  } | null;
  student_count?: number;
}

export function useClasses() {
  const { currentSchoolId, isSuperAdmin } = useSchoolContext();
  const { primaryRole } = useAuth();
  const { data: currentTeacher } = useCurrentTeacher();
  const isTeacher = primaryRole === 'teacher';

  return useQuery({
    queryKey: ['classes', currentSchoolId, isTeacher ? currentTeacher?.id : null],
    queryFn: async (): Promise<ClassWithTeacher[]> => {
      const classes: ClassWithTeacher[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const response = await api.get<{ data?: any[]; totalPages?: number }>('/classes', {
          params: { school_id: currentSchoolId || undefined, page, limit: 500 },
        });
        classes.push(...(response.data || []).map((c: any) => ({
           ...c,
           monthly_fee: c.monthly_fee ?? c.monthlyFee ?? null,
         })));
        totalPages = response.totalPages || 1;
        page += 1;
      } while (page <= totalPages);
      return classes;
    },
    enabled: (!!currentSchoolId || isSuperAdmin) && (!isTeacher || !!currentTeacher),
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentSchoolId } = useSchoolContext();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      school_id?: string;
      grade?: string;
      section?: string;
      capacity?: number;
      teacher_id?: string;
      monthly_fee?: number | null;
    }) => {
      await api.post('/classes', {
        name: data.name,
        school_id: data.school_id || currentSchoolId,
        grade: data.grade || null,
        section: data.section || null,
        capacity: data.capacity || 30,
        teacher_id: data.teacher_id || null,
        monthly_fee: data.monthly_fee ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: 'Class created',
        description: 'The class has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating class',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentSchoolId } = useSchoolContext();

  return useMutation({
    mutationFn: async ({
      id,
      school_id,
      ...data
    }: {
      id: string;
      school_id?: string;
      name?: string;
      grade?: string;
      section?: string;
      capacity?: number;
      teacher_id?: string | null;
      monthly_fee?: number | null;
      program?: string;
      level_label?: string;
      education_level?: string;
    }) => {
      const res = await api.put<{ data?: any }>(`/classes/${id}`, { ...data, school_id: school_id || currentSchoolId });
      const c = res?.data;
      if (c) {
        return {
          ...c,
          monthly_fee: c.monthly_fee ?? c.monthlyFee ?? null,
          program: c.program ?? null,
          level_label: c.level_label ?? null,
          education_level: c.education_level ?? null,
        } as ClassWithTeacher;
      }
      return undefined as any;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueriesData({ queryKey: ['classes'] }, (old: any) => {
        if (!old) return old;
        const patch = (cls: any) =>
          cls.id === variables.id
            ? { ...cls, monthly_fee: data?.monthly_fee ?? data?.monthlyFee ?? cls.monthly_fee, name: data?.name ?? cls.name, grade: data?.grade ?? cls.grade, section: data?.section ?? cls.section, capacity: data?.capacity ?? cls.capacity, program: data?.program ?? cls.program, level_label: data?.level_label ?? cls.level_label }
            : cls;
        if (Array.isArray(old)) return old.map(patch);
        if (Array.isArray(old?.data)) return { ...old, data: old.data.map(patch) };
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['class-fees'] });
      toast({
        title: 'Class updated',
        description: 'The class has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating class',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/classes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: 'Class deleted',
        description: 'The class has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting class',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAssignTeacherToClass() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      classId,
      teacherId,
    }: {
      classId: string;
      teacherId: string | null;
    }) => {
      await api.post(`/classes/${classId}/assign-teacher`, { teacher_id: teacherId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: 'Teacher assigned',
        description: 'The teacher has been assigned to the class.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error assigning teacher',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useEnrollStudent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      classId,
      studentId,
    }: {
      classId: string;
      studentId: string;
    }) => {
      await api.post(`/classes/${classId}/enroll`, { student_ids: [studentId] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast({
        title: 'Student enrolled',
        description: 'The student has been enrolled in the class.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error enrolling student',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
