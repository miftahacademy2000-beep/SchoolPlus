import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export interface TimetableSlot {
  id: string;
  class_id: string;
  course_id: string | null;
  teacher_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  created_at: string;
  course?: {
    id: string;
    name: string;
    code: string;
  } | null;
  teacher?: {
    id: string;
    profile: {
      full_name: string | null;
    } | null;
  } | null;
  class?: {
    id: string;
    name: string;
    grade: string | null;
  } | null;
}

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function useTimetable(classId: string | null) {
  return useQuery({
    queryKey: ['timetable', classId],
    queryFn: async (): Promise<TimetableSlot[]> => {
      if (!classId) return [];
      const params = new URLSearchParams({ class_id: classId });
      const { data } = await api.get<TimetableSlot[]>(`/timetable?${params.toString()}`);
      return data || [];
    },
    enabled: !!classId,
  });
}

export function useCreateTimetableSlot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      class_id: string;
      course_id?: string;
      teacher_id?: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      room?: string;
    }) => {
      await api.post('/timetable', {
        class_id: data.class_id,
        course_id: data.course_id || null,
        teacher_id: data.teacher_id || null,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
        room: data.room || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      toast({
        title: 'Slot added',
        description: 'The timetable slot has been added successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error adding slot',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateTimetableSlot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      course_id?: string | null;
      teacher_id?: string | null;
      day_of_week?: number;
      start_time?: string;
      end_time?: string;
      room?: string | null;
    }) => {
      await api.put(`/timetable/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      toast({
        title: 'Slot updated',
        description: 'The timetable slot has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating slot',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteTimetableSlot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/timetable/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      toast({
        title: 'Slot deleted',
        description: 'The timetable slot has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error deleting slot',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
