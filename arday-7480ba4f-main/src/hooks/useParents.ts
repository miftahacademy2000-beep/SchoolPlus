import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from './useSchoolContext';

export interface ParentWithProfile {
  id: string;
  user_id: string;
  school_id: string;
  phone: string | null;
  address: string | null;
  occupation: string | null;
  created_at: string;
  profile: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  children?: {
    id: string;
    student_id: string;
    student_name: string | null;
  }[];
}

export function useParents() {
  const { currentSchoolId, isSuperAdmin } = useSchoolContext();

  return useQuery({
    queryKey: ['parents', currentSchoolId],
    queryFn: async (): Promise<ParentWithProfile[]> => {
      const params = new URLSearchParams();
      if (!isSuperAdmin && currentSchoolId) {
        params.set('school_id', currentSchoolId);
      }
      const qs = params.toString();
      const { data } = await api.get<ParentWithProfile[]>(`/parents${qs ? `?${qs}` : ''}`);
      return data || [];
    },
    enabled: !!currentSchoolId || isSuperAdmin,
  });
}

export function useCreateParent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentSchoolId } = useSchoolContext();

  return useMutation({
    mutationFn: async (data: {
      user_id: string;
      school_id?: string;
      phone?: string;
      address?: string;
      occupation?: string;
    }) => {
      await api.post('/parents', {
        user_id: data.user_id,
        school_id: data.school_id || currentSchoolId,
        phone: data.phone || null,
        address: data.address || null,
        occupation: data.occupation || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      toast({
        title: 'Parent added',
        description: 'The parent has been added successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error adding parent',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateParent() {
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
      phone?: string;
      address?: string;
      occupation?: string;
    }) => {
      await api.put(`/parents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      toast({
        title: 'Parent updated',
        description: 'The parent has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating parent',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export { useArchiveUser as useDeleteParent } from './useArchivedUsers';

export function useLinkParentToStudent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      parentId,
      studentId,
      relationship = 'parent',
    }: {
      parentId: string;
      studentId: string;
      relationship?: string;
    }) => {
      await api.post(`/parents/${parentId}/link-student`, {
        student_id: studentId,
        relationship,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({
        title: 'Student linked',
        description: 'The student has been linked to the parent.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error linking student',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUnlinkParentFromStudent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ parentId, studentId }: { parentId: string; studentId: string }) => {
      await api.delete(`/parents/${parentId}/unlink-student/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({
        title: 'Student unlinked',
        description: 'The student has been unlinked from the parent.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error unlinking student',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
