import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSchoolContext } from './useSchoolContext';

export interface SchoolDashboardStats {
  schoolName: string;
  studentCount: number;
  teacherCount: number;
  parentCount: number;
  courseCount: number;
  classCount: number;
  attendanceRate: number;
  recentStudents: Array<{
    id: string;
    name: string;
    grade: string | null;
    enrolledAt: string;
  }>;
  weeklyAttendance: Array<{
    name: string;
    attendance: number;
  }>;
  invoiceStats: {
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
    invoiceCount: number;
    paidCount: number;
    overdueCount: number;
    carryForwardCount: number;
    carryForwardAmount: number;
    monthlyTrend: Array<{ name: string; paid: number; pending: number; overdue: number }>;
    yearlyTrend: Array<{ name: string; paid: number; pending: number; overdue: number }>;
  };
}

export function useSchoolDashboard() {
  const { currentSchoolId, isSuperAdmin } = useSchoolContext();

  return useQuery({
    queryKey: ['school-dashboard', currentSchoolId],
    queryFn: async (): Promise<SchoolDashboardStats> => {
      if (!currentSchoolId) {
        throw new Error('No school selected');
      }

      const { data } = await api.get<SchoolDashboardStats>(`/schools/${currentSchoolId}/dashboard`);
      if (!data) throw new Error('No dashboard data received');
      return data;
    },
    enabled: !!currentSchoolId,
  });
}
