import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface UpdateCredentialsData {
  user_id: string;
  school_id: string;
  role: 'teacher' | 'student' | 'school_admin';
  new_login_id?: string;
  new_password?: string;
  new_email?: string;
  full_name?: string;
  phone?: string;
  enrollment_number?: string;
  grade?: string;
  date_of_birth?: string;
  parent_id?: string;
  employee_id?: string;
  department?: string;
  subjects?: string[];
}

export function useUpdateCredentials() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateCredentialsData) => {
      const payload = {
        user_id: data.user_id,
        userId: data.user_id,
        school_id: data.school_id,
        role: data.role,
        ...(data.new_login_id !== undefined && { login_id: data.new_login_id, new_login_id: data.new_login_id }),
        ...(data.new_password !== undefined && { password: data.new_password, new_password: data.new_password }),
        ...(data.new_email !== undefined && { email: data.new_email, new_email: data.new_email }),
        ...(data.full_name !== undefined && { full_name: data.full_name, fullName: data.full_name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.enrollment_number !== undefined && { enrollment_number: data.enrollment_number }),
        ...(data.grade !== undefined && { grade: data.grade }),
        ...(data.date_of_birth !== undefined && { date_of_birth: data.date_of_birth }),
        ...(data.parent_id !== undefined && { parent_id: data.parent_id }),
        ...(data.employee_id !== undefined && { employee_id: data.employee_id }),
        ...(data.department !== undefined && { department: data.department }),
        ...(data.subjects !== undefined && { subjects: data.subjects }),
      };

      const { data: result } = await api.post<any>('/users/update-credentials', payload);

      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`${variables.role}s`] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: 'Credentials updated',
        description: 'Login credentials have been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating credentials',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
