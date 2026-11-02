import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export interface CreateUserData {
  email?: string;
  login_id?: string;
  password: string;
  full_name: string;
  role: 'teacher' | 'student' | 'parent';
  school_id: string;
  employee_id?: string;
  department?: string;
  subjects?: string[];
  enrollment_number?: string;
  grade?: string;
  date_of_birth?: string;
  phone?: string;
  occupation?: string;
  address?: string;
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateUserData) => {
      const { data: result } = await api.post<any>('/users', data);

      if (result?.error) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`${variables.role}s`] });
      queryClient.invalidateQueries({ queryKey: ['users'] });

      toast({
        title: 'User created',
        description: `The ${variables.role} account has been created successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error creating user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
