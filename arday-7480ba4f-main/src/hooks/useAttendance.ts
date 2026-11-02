import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  notes: string | null;
  marked_by: string | null;
  created_at: string;
  student?: {
    id: string;
    profile: {
      full_name: string | null;
    } | null;
  } | null;
  marked_by_profile?: {
    full_name: string | null;
  } | null;
}

export function useAttendance(classId: string | null, date: Date) {
  const formattedDate = format(date, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['attendance', classId, formattedDate],
    queryFn: async (): Promise<AttendanceRecord[]> => {
      if (!classId) return [];

      const params = new URLSearchParams({ class_id: classId, date: formattedDate });
      const { data } = await api.get<AttendanceRecord[]>(`/attendance?${params.toString()}`);
      return data || [];
    },
    enabled: !!classId,
  });
}

export function useClassStudentsForAttendance(classId: string | null) {
  return useQuery({
    queryKey: ['class-students-attendance', classId],
    queryFn: async () => {
      if (!classId) return [];
      const { data } = await api.get<any[]>(`/classes/${classId}/students`);
      return data || [];
    },
    enabled: !!classId,
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      studentId,
      classId,
      date,
      status,
      notes,
      markedBy,
    }: {
      studentId: string;
      classId: string;
      date: string;
      status: AttendanceStatus;
      notes?: string;
      markedBy?: string;
    }) => {
      await api.post('/attendance', {
        student_id: studentId,
        class_id: classId,
        date,
        status,
        notes: notes || null,
        marked_by: markedBy || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error marking attendance',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useBulkMarkAttendance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (
      records: {
        studentId: string;
        classId: string;
        date: string;
        status: AttendanceStatus;
        markedBy?: string;
      }[]
    ) => {
      await api.post('/attendance/bulk', {
        records: records.map(r => ({
          student_id: r.studentId,
          class_id: r.classId,
          date: r.date,
          status: r.status,
          marked_by: r.markedBy || null,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({
        title: 'Attendance saved',
        description: 'Attendance records have been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error saving attendance',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteAttendance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => api.delete(`/attendance/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error clearing attendance',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
