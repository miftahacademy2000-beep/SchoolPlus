import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CourseStudent {
  id: string;
  user_id: string;
  enrollment_number: string | null;
  grade: string | null;
  class_name: string;
  profile: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

export interface CourseMaterial {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface CourseDetails {
  id: string;
  name: string;
  code: string;
  description: string | null;
  credits: number | null;
  school_id: string;
  teacher_id: string | null;
  teacher?: {
    id: string;
    profile?: {
      full_name: string | null;
    } | null;
  } | null;
}

export function useCourseDetails(courseId: string | undefined) {
  return useQuery({
    queryKey: ['course-details', courseId],
    queryFn: async (): Promise<CourseDetails | null> => {
      if (!courseId) return null;
      const { data } = await api.get<CourseDetails>(`/courses/${courseId}`);
      return data || null;
    },
    enabled: !!courseId,
  });
}

export function useCourseStudents(courseId: string | undefined) {
  return useQuery({
    queryKey: ['course-students', courseId],
    queryFn: async (): Promise<CourseStudent[]> => {
      if (!courseId) return [];
      const { data } = await api.get<CourseStudent[]>(`/courses/${courseId}/students`);
      return data || [];
    },
    enabled: !!courseId,
  });
}

export function useCourseMaterials(courseId: string | undefined) {
  return useQuery({
    queryKey: ['course-materials', courseId],
    queryFn: async (): Promise<CourseMaterial[]> => {
      if (!courseId) return [];
      const { data } = await api.get<CourseMaterial[]>(`/courses/${courseId}/materials`);
      return data || [];
    },
    enabled: !!courseId,
  });
}
