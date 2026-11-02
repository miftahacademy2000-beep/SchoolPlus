import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { toast } from 'sonner';

export interface Assignment {
  id: string;
  title: string;
  description: string | null;
  course_id: string;
  class_id: string | null;
  teacher_id: string | null;
  due_date: string;
  max_score: number;
  assignment_type: string;
  status: string;
  attachments: string[] | null;
  created_at: string;
  updated_at: string;
  course?: {
    id: string;
    name: string;
    code: string;
  };
  class?: {
    id: string;
    name: string;
  } | null;
  teacher?: {
    id: string;
    profile?: {
      full_name: string | null;
    };
  } | null;
  _count?: {
    submissions: number;
    graded: number;
  };
}

export interface AssignmentFormData {
  title: string;
  description?: string;
  course_id: string;
  class_id?: string;
  due_date: string;
  max_score?: number;
  assignment_type?: string;
  status?: string;
}

export function useAssignments() {
  const { user } = useAuth();
  const { currentSchoolId, isSuperAdmin } = useSchoolContext();

  return useQuery({
    queryKey: ['assignments', currentSchoolId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentSchoolId) params.set('school_id', currentSchoolId);
      const qs = params.toString();
      const { data } = await api.get<Assignment[]>(`/assignments${qs ? `?${qs}` : ''}`);
      return data || [];
    },
    enabled: !!user,
  });
}

export function useTeacherAssignments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['teacher-assignments', user?.id],
    queryFn: async () => {
      const { data } = await api.get<Assignment[]>('/assignments/teacher');
      return data || [];
    },
    enabled: !!user,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AssignmentFormData) => {
      const { data: assignment } = await api.post<Assignment>('/assignments', {
        ...data,
        max_score: data.max_score || 100,
        assignment_type: data.assignment_type || 'homework',
        status: data.status || 'draft',
      });
      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      toast.success('Assignment created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create assignment: ${error.message}`);
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Assignment> & { id: string }) => {
      const { data: assignment } = await api.put<Assignment>(`/assignments/${id}`, data);
      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      toast.success('Assignment updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update assignment: ${error.message}`);
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/assignments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      toast.success('Assignment deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete assignment: ${error.message}`);
    },
  });
}
