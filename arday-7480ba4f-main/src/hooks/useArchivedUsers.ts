import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from './useSchoolContext';

export interface ArchivedUser {
  id: string;
  original_id: string;
  user_id: string;
  school_id: string | null;
  user_type: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  metadata: Record<string, unknown>;
  archived_by: string | null;
  archived_at: string;
  reason: string | null;
}

export function useArchivedUsers() {
  const { currentSchoolId, isSuperAdmin } = useSchoolContext();

  return useQuery({
    queryKey: ['archived-users', currentSchoolId],
    queryFn: async (): Promise<ArchivedUser[]> => {
      const params = new URLSearchParams();
      if (!isSuperAdmin && currentSchoolId) {
        params.set('school_id', currentSchoolId);
      }
      const qs = params.toString();
      const { data } = await api.get<ArchivedUser[]>(`/archived-users${qs ? `?${qs}` : ''}`);
      return data || [];
    },
    enabled: !!currentSchoolId || isSuperAdmin,
  });
}

export function useArchiveUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      originalId: string;
      userId: string;
      schoolId: string;
      userType: 'student' | 'teacher' | 'parent';
      fullName: string | null;
      email: string | null;
      phone?: string | null;
      avatarUrl?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      await api.post('/archived-users', {
        original_id: params.originalId,
        user_id: params.userId,
        school_id: params.schoolId,
        user_type: params.userType,
        full_name: params.fullName,
        email: params.email,
        phone: params.phone || null,
        avatar_url: params.avatarUrl || null,
        metadata: params.metadata || {},
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`${variables.userType}s`] });
      queryClient.invalidateQueries({ queryKey: ['archived-users'] });
      toast({
        title: 'User archived',
        description: `The ${variables.userType} has been archived successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error archiving user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRestoreUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (archivedUser: ArchivedUser) => {
      await api.post(`/archived-users/restore/${archivedUser.id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`${variables.user_type}s`] });
      queryClient.invalidateQueries({ queryKey: ['archived-users'] });
      toast({
        title: 'User restored',
        description: `The ${variables.user_type} has been restored successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error restoring user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function usePermanentlyDeleteArchived() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/archived-users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-users'] });
      toast({
        title: 'Permanently deleted',
        description: 'The archived record has been permanently removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting record',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
