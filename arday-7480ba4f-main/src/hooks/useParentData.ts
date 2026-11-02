import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface ChildProfile {
  id: string;
  user_id: string;
  school_id: string;
  enrollment_number: string | null;
  grade: string | null;
  date_of_birth: string | null;
  relationship: string | null;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  school: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
}

export interface ChildClass {
  id: string;
  class_id: string;
  enrolled_at: string;
  class: {
    id: string;
    name: string;
    grade: string | null;
    section: string | null;
    teacher: {
      id: string;
      profile: {
        full_name: string | null;
      } | null;
    } | null;
  } | null;
}

export interface ChildGrade {
  id: string;
  title: string;
  score: number;
  max_score: number;
  grade_type: string;
  graded_at: string;
  notes: string | null;
  course: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface ChildAttendance {
  id: string;
  date: string;
  status: string;
  notes: string | null;
  class: {
    id: string;
    name: string;
  } | null;
}

export interface ChildTimetableSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  course: {
    id: string;
    name: string;
    code: string;
  } | null;
  teacher: {
    id: string;
    profile: {
      full_name: string | null;
    } | null;
  } | null;
  class: {
    id: string;
    name: string;
  } | null;
}

export interface ChildInvoice {
  id: string;
  invoice_number: string;
  title: string;
  description: string | null;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  created_at: string;
}

export function useParentChildren() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parent-children', user?.id],
    queryFn: async (): Promise<ChildProfile[]> => {
      if (!user?.id) return [];
      const { data } = await api.get<ChildProfile[]>('/parent-portal/children');
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useChildClasses(studentId: string | null) {
  return useQuery({
    queryKey: ['child-classes', studentId],
    queryFn: async (): Promise<ChildClass[]> => {
      if (!studentId) return [];
      const { data } = await api.get<ChildClass[]>(`/parent-portal/children/${studentId}/classes`);
      return data || [];
    },
    enabled: !!studentId,
  });
}

export function useChildGrades(studentId: string | null) {
  return useQuery({
    queryKey: ['child-grades', studentId],
    queryFn: async (): Promise<ChildGrade[]> => {
      if (!studentId) return [];
      const { data } = await api.get<ChildGrade[]>(`/parent-portal/children/${studentId}/grades`);
      return data || [];
    },
    enabled: !!studentId,
  });
}

export function useChildAttendance(studentId: string | null) {
  return useQuery({
    queryKey: ['child-attendance', studentId],
    queryFn: async (): Promise<ChildAttendance[]> => {
      if (!studentId) return [];
      const { data } = await api.get<ChildAttendance[]>(`/parent-portal/children/${studentId}/attendance`);
      return data || [];
    },
    enabled: !!studentId,
  });
}

export function useChildTimetable(studentId: string | null) {
  return useQuery({
    queryKey: ['child-timetable', studentId],
    queryFn: async (): Promise<ChildTimetableSlot[]> => {
      if (!studentId) return [];
      const { data } = await api.get<ChildTimetableSlot[]>(`/parent-portal/children/${studentId}/timetable`);
      return data || [];
    },
    enabled: !!studentId,
  });
}

export function useChildInvoices(studentId: string | null) {
  return useQuery({
    queryKey: ['child-invoices', studentId],
    queryFn: async (): Promise<ChildInvoice[]> => {
      if (!studentId) return [];
      const { data } = await api.get<ChildInvoice[]>(`/parent-portal/children/${studentId}/invoices`);
      return data || [];
    },
    enabled: !!studentId,
  });
}
