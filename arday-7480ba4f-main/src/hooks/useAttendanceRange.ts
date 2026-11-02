import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { extractStudentIdNum } from '@/lib/studentSorting';
import type { AttendanceStatus } from '@/hooks/useAttendance';

export interface AttendanceRangeRecord {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  notes: string | null;
  student_name: string;
}

export interface DailyTrend {
  date: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
}

export interface StudentSummary {
  student_id: string;
  student_name: string;
  enrollment_number: string | null;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
}

export function useAttendanceRange(
  classId: string | null,
  startDate: Date,
  endDate: Date
) {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['attendance-range', classId, start, end],
    queryFn: async () => {
      if (!classId) return { records: [], dailyTrends: [], studentSummaries: [] };

      const params = new URLSearchParams({ class_id: classId, start, end });
      const { data: result } = await api.get<{ records: any[]; dailyTrends: DailyTrend[]; studentSummaries: StudentSummary[] }>(`/attendance/range?${params.toString()}`);

      return result || { records: [], dailyTrends: [], studentSummaries: [] };
    },
    enabled: !!classId,
  });
}
