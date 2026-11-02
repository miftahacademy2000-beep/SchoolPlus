import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PlatformStats {
  totals: {
    totalSchools: number;
    activeSchools: number;
    pendingSchools: number;
    suspendedSchools: number;
    inactiveSchools: number;
    totalUsers: number;
    activeUsers: number;
    totalStudents: number;
    totalTeachers: number;
    totalParents: number;
    totalClasses: number;
    totalCourses: number;
    totalInvoices: number;
    paidInvoices: number;
    unpaidInvoices: number;
    pendingInvoices: number;
    overdueInvoices: number;
    pendingInquiries: number;
    activeSubscriptions: number;
  };
  financials: {
    invoicePaymentsReceived: Array<{ currency: string; amount: number }>;
    outstandingBalance: Array<{ currency: string; amount: number }>;
    subscriptionPaymentsReceived: number;
    subscriptionCurrency: string;
  };
  planDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  recentSchools: Array<{
    id: string;
    name: string;
    slug: string;
    email: string | null;
    status: string;
    plan: string;
    studentCount: number;
    teacherCount: number;
    createdAt: Date;
  }>;
  monthlyStats: Array<{
    name: string;
    schools: number;
    students: number;
    revenue: Record<string, number>;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    createdAt: string;
    amount?: number;
    currency?: string;
  }>;
}

export function useSuperAdminDashboard() {
  return useQuery({
    queryKey: ['super-admin-dashboard'],
    queryFn: async (): Promise<PlatformStats> => {
      const { data } = await api.get<{ data: PlatformStats }>('/analytics/platform');
      if (!data) throw new Error('No platform data received');
      return data;
    },
    staleTime: 30000,
  });
}
