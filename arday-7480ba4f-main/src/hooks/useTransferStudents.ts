import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface TransferResult {
  success: boolean;
  transferred: number;
  errors: number;
  results: { student_id: string; status: string; name?: string; error?: string }[];
}

export function useTransferStudents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      studentIds,
      targetSchoolId,
      sourceSchoolId,
    }: {
      studentIds: string[];
      targetSchoolId: string;
      sourceSchoolId: string;
    }): Promise<TransferResult> => {
      const { data } = await api.post<TransferResult>('/transfer/students', {
        student_ids: studentIds,
        target_school_id: targetSchoolId,
        source_school_id: sourceSchoolId,
      });

      if (!data?.success) throw new Error((data as any)?.error || 'Transfer failed');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-invoices-balance'] });
      toast({
        title: 'Transfer complete',
        description: `${data.transferred} student(s) transferred successfully${data.errors > 0 ? `, ${data.errors} failed` : ''}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Transfer failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
