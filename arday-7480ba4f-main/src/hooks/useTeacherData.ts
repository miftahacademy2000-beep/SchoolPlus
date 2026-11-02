import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface TeacherProfile {
  id: string;
  user_id: string;
  school_id: string;
  employee_id: string | null;
  department: string | null;
  subjects: string[] | null;
  created_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
  school: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
}

export interface TeacherClass {
  id: string;
  name: string;
  grade: string | null;
  section: string | null;
  capacity: number | null;
  student_count: number;
}

export interface TeacherCourse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  credits: number | null;
}

export interface ClassStudent {
  id: string;
  enrollment_number: string | null;
  grade: string | null;
  profile: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

export interface TeacherGrade {
  id: string;
  title: string;
  score: number;
  max_score: number;
  grade_type: string;
  graded_at: string;
  notes: string | null;
  student: {
    id: string;
    profile: {
      full_name: string | null;
    } | null;
  } | null;
  course: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface TeacherTimetableSlot {
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
  class: {
    id: string;
    name: string;
    section: string | null;
  } | null;
}

export interface ClassPerformance {
  classId: string;
  className: string;
  averageGrade: number;
  attendanceRate: number;
  studentCount: number;
}

export function useTeacherProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['teacher-profile', user?.id],
    queryFn: async (): Promise<TeacherProfile | null> => {
      if (!user?.id) return null;
      const { data } = await api.get<TeacherProfile>('/teacher-portal');
      return data || null;
    },
    enabled: !!user?.id,
  });
}

export function useTeacherClasses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['teacher-classes', user?.id],
    queryFn: async (): Promise<TeacherClass[]> => {
      if (!user?.id) return [];
      const { data } = await api.get<TeacherClass[]>('/teacher-portal/classes');
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useTeacherCourses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['teacher-courses', user?.id],
    queryFn: async (): Promise<TeacherCourse[]> => {
      if (!user?.id) return [];
      const { data } = await api.get<TeacherCourse[]>('/teacher-portal/courses');
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useClassStudents(classId: string | null) {
  return useQuery({
    queryKey: ['class-students-detail', classId],
    queryFn: async (): Promise<ClassStudent[]> => {
      if (!classId) return [];
      const { data } = await api.get<ClassStudent[]>(`/classes/${classId}/students`);
      return data || [];
    },
    enabled: !!classId,
  });
}

export function useTeacherGrades(courseId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['teacher-grades', user?.id, courseId],
    queryFn: async (): Promise<TeacherGrade[]> => {
      if (!user?.id) return [];
      const params = new URLSearchParams();
      if (courseId) params.set('course_id', courseId);
      const qs = params.toString();
      const { data } = await api.get<TeacherGrade[]>(`/teacher-portal/grades${qs ? `?${qs}` : ''}`);
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useTeacherTimetable() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['teacher-timetable', user?.id],
    queryFn: async (): Promise<TeacherTimetableSlot[]> => {
      if (!user?.id) return [];
      const { data } = await api.get<TeacherTimetableSlot[]>('/teacher-portal/timetable');
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useClassPerformance() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['class-performance', user?.id],
    queryFn: async (): Promise<ClassPerformance[]> => {
      if (!user?.id) return [];
      const { data } = await api.get<ClassPerformance[]>('/teacher-portal/performance');
      return data || [];
    },
    enabled: !!user?.id,
  });
}
