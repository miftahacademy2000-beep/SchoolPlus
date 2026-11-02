import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek, subWeeks, getDay } from 'date-fns';

export interface WeeklyTrend {
  label: string;
  rate: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export interface MonthlyTrend {
  label: string;
  rate: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export interface ClassAttendanceSummary {
  class_id: string;
  class_name: string;
  grade: string | null;
  section: string | null;
  rate: number;
  total_records: number;
  present: number;
  absent: number;
}
export interface DayOfWeekPattern {
  day: number;
  label: string;
  rate: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

export type TrendView = 'weekly' | 'monthly';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function useAttendanceAnalytics(trendView: TrendView = 'monthly') {
  const { currentSchoolId } = useSchoolContext();

  return useQuery({
    queryKey: ['attendance-analytics', currentSchoolId, trendView],
    queryFn: async () => {
      if (!currentSchoolId) return null;

      const params = new URLSearchParams({ school_id: currentSchoolId, trendView });
      const { data: analyticsData } = await api.get<any>(`/analytics/attendance?${params.toString()}`);

      if (!analyticsData) return null;

      return analyticsData;
    },
    enabled: !!currentSchoolId,
  });
}
