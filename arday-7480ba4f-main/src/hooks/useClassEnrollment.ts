import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface StudentWithProfile {
  id: string;
  user_id: string;
  enrollment_number: string | null;
  grade: string | null;
  profile: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export function useClassEnrollment(classId: string) {
  return useQuery({
    queryKey: ['class-enrollment', classId],
    queryFn: async () => {
      const { data } = await api.get<{ enrolledStudents: StudentWithProfile[]; availableStudents: StudentWithProfile[] }>(`/classes/${classId}/students`);
      return data || { enrolledStudents: [], availableStudents: [] };
    },
    enabled: !!classId,
  });
}

export function useEnrollStudents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      classId,
      studentIds,
    }: {
      classId: string;
      studentIds: string[];
    }) => {
      await api.post(`/classes/${classId}/enroll`, { student_ids: studentIds });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['class-enrollment', variables.classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({
        title: 'Students enrolled',
        description: `Successfully enrolled ${variables.studentIds.length} student(s).`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error enrolling students',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUnenrollStudent() {
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
      await api.delete(`/classes/${classId}/enroll/${studentId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['class-enrollment', variables.classId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({
        title: 'Student unenrolled',
        description: 'The student has been removed from the class.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error unenrolling student',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
