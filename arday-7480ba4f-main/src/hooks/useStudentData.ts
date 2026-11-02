import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export interface StudentProfile {
  id: string;
  user_id: string;
  school_id: string;
  enrollment_number: string | null;
  grade: string | null;
  date_of_birth: string | null;
  created_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    login_id: string | null;
    avatar_url: string | null;
    phone: string | null;
  } | null;
  school: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
}

export interface EnrolledClass {
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

export interface StudentCourse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  credits: number | null;
  teacher: {
    id: string;
    profile: {
      full_name: string | null;
    } | null;
  } | null;
}

export interface StudentGrade {
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

export interface StudentAttendance {
  id: string;
  date: string;
  status: string;
  notes: string | null;
  class: {
    id: string;
    name: string;
  } | null;
}

export interface StudentTimetableSlot {
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

export interface StudentExam {
  id: string;
  score: number;
  max_score: number;
  weight: number;
  remarks: string | null;
  created_at: string;
  classes: { id: string; name: string };
  subjects: { id: string; name: string } | null;
  terms: { id: string; name: string } | null;
  exam_types: { id: string; name: string } | null;
}

export interface StudentInvoice {
  id: string;
  invoiceNumber: string;
  title: string;
  description: string | null;
  amount: number | string;
  amountPaid: number | string;
  dueDate: string;
  status: string;
  currency: string;
  paymentHistory: {
    id: string;
    amount: number | string;
    paymentMethod: string | null;
    notes: string | null;
    createdAt: string;
  }[];
}

export interface StudentInvoiceData {
  invoices: StudentInvoice[];
  summary: {
    total: number;
    pending: number;
    paid: number;
    overdue: number;
    totalAmount: number;
    totalPaid: number;
    totalOutstanding: number;
  };
}

export function useStudentProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-profile', user?.id],
    queryFn: async (): Promise<StudentProfile | null> => {
      if (!user?.id) return null;
      const { data } = await api.get<StudentProfile>('/student-portal');
      return data || null;
    },
    enabled: !!user?.id,
  });
}

export function useStudentClasses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-classes', user?.id],
    queryFn: async (): Promise<EnrolledClass[]> => {
      if (!user?.id) return [];
      const { data } = await api.get<EnrolledClass[]>('/student-portal/classes');
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useStudentCourses() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-courses', user?.id],
    queryFn: async (): Promise<StudentCourse[]> => {
      if (!user?.id) return [];
      const { data } = await api.get<StudentCourse[]>('/student-portal/courses');
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useStudentGrades() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-grades', user?.id],
    queryFn: async (): Promise<StudentGrade[]> => {
      if (!user?.id) return [];
      const { data } = await api.get<StudentGrade[]>('/student-portal/grades');
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useStudentExams() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-exams', user?.id],
    queryFn: async (): Promise<StudentExam[]> => {
      if (!user?.id) return [];
      const { data } = await api.get<StudentExam[]>('/student-portal/exams');
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useStudentInvoices() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-invoices', user?.id],
    queryFn: async (): Promise<StudentInvoiceData | null> => {
      if (!user?.id) return null;
      const { data } = await api.get<StudentInvoiceData>('/student-portal/invoices');
      return data || null;
    },
    enabled: !!user?.id,
  });
}

export function useStudentAttendance() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-attendance', user?.id],
    queryFn: async (): Promise<StudentAttendance[]> => {
      if (!user?.id) return [];
      const { data } = await api.get<StudentAttendance[]>('/student-portal/attendance');
      return data || [];
    },
    enabled: !!user?.id,
  });
}

export function useStudentTimetable() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-timetable', user?.id],
    queryFn: async (): Promise<StudentTimetableSlot[]> => {
      if (!user?.id) return [];
      const { data } = await api.get<StudentTimetableSlot[]>('/student-portal/timetable');
      return data || [];
    },
    enabled: !!user?.id,
  });
}
