import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export type AppRole = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

export interface UserWithRoles {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: {
    id: string;
    role: AppRole;
    school_id: string | null;
    school_name?: string;
  }[];
}

export interface SchoolOption {
  id: string;
  name: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async (): Promise<UserWithRoles[]> => {
      const { data } = await api.get<UserWithRoles[]>('/users');
      return data || [];
    },
  });
}

export function useSchools() {
  return useQuery({
    queryKey: ['schools-list'],
    queryFn: async (): Promise<SchoolOption[]> => {
      const { data } = await api.get<SchoolOption[]>('/schools');
      return data || [];
    },
  });
}

export function useAddRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      userId,
      role,
      schoolId,
    }: {
      userId: string;
      role: AppRole;
      schoolId: string | null;
    }) => {
      await api.post(`/users/${userId}/roles`, {
        role,
        school_id: schoolId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Role added',
        description: 'The role has been assigned successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error adding role',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useRemoveRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      await api.delete(`/users/${userId}/roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({
        title: 'Role removed',
        description: 'The role has been removed successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error removing role',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
