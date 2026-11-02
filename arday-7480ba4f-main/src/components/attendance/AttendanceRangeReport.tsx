import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useClasses } from '@/hooks/useClasses';
import { useAttendanceRange } from '@/hooks/useAttendanceRange';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CalendarIcon,
  Loader2,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  FileDown,
  Share2,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, subDays, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { exportAttendanceRangeReportPdf } from '@/lib/attendanceRangeExport';
import { downloadStudentAttendancePdf, shareStudentAttendanceViaWhatsApp } from '@/lib/studentAttendanceExport';
import type { AttendanceStatus } from '@/hooks/useAttendance';

type RangePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

function getPresetDates(preset: RangePreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case 'this_week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'last_week': {
      const lastWeek = subDays(now, 7);
      return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
    }
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    default:
      return { start: subDays(now, 7), end: now };
  }
}

export default function AttendanceRangeReport() {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [rangePreset, setRangePreset] = useState<RangePreset>('this_week');
  const [customStart, setCustomStart] = useState<Date>(subDays(new Date(), 7));
  const [customEnd, setCustomEnd] = useState<Date>(new Date());

  const { data: classes, isLoading: classesLoading } = useClasses();
  const { currentSchoolId } = useSchoolContext();

  const dateRange = useMemo(() => {
    if (rangePreset === 'custom') return { start: customStart, end: customEnd };
    return getPresetDates(rangePreset);
  }, [rangePreset, customStart, customEnd]);

  const { data, isLoading } = useAttendanceRange(
    selectedClassId || null,
    dateRange.start,
    dateRange.end
  );
  // Fetch parent phone numbers for students in the selected class
  const studentIds = useMemo(() => data?.studentSummaries.map(s => s.student_id) || [], [data]);
  const { data: parentPhones } = useQuery({
    queryKey: ['parent-phones', studentIds],
    queryFn: async () => {
      if (!studentIds.length) return {};
      const response = await api.get<{ data: { student_id: string; phone: string | null }[] }>('/parents', {
        params: { school_id: currentSchoolId },
      });
      const parentPhonesRaw = response.data || [];
      const phoneMap: Record<string, string | null> = {};
      parentPhonesRaw.forEach(p => { if (p.phone) phoneMap[p.student_id] = p.phone; });
      return phoneMap;
    },
    enabled: studentIds.length > 0,
  });

  const overallStats = useMemo(() => {
    if (!data?.records.length) return { total: 0, present: 0, absent: 0, late: 0, excused: 0, rate: 0 };
    const total = data.records.length;
    const present = data.records.filter(r => r.status === 'present').length;
    const absent = data.records.filter(r => r.status === 'absent').length;
    const late = data.records.filter(r => r.status === 'late').length;
    const excused = data.records.filter(r => r.status === 'excused').length;
    const rate = Math.round(((present + late) / total) * 100);
    return { total, present, absent, late, excused, rate };
  }, [data]);

  const chartData = useMemo(() => {
    return (data?.dailyTrends || []).map(d => ({
      ...d,
      date: format(new Date(d.date + 'T00:00:00'), 'dd/MM'),
    }));
  }, [data]);

  const handleExportPdf = () => {
    if (!selectedClassId || !data) return;
    const cls = classes?.find(c => c.id === selectedClassId);
    if (!cls) return;
    exportAttendanceRangeReportPdf(
      { name: cls.name, grade: cls.grade, section: cls.section },
      dateRange.start,
      dateRange.end,
      overallStats,
      data.dailyTrends,
      data.studentSummaries,
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classesLoading ? (
                    <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                  ) : (
                    classes?.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} {cls.grade && `- ${cls.grade}`} {cls.section && `(${cls.section})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Select value={rangePreset} onValueChange={(v) => setRangePreset(v as RangePreset)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="last_week">Last Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {rangePreset === 'custom' && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(customStart, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStart}
                      onSelect={(d) => d && setCustomStart(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(customEnd, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEnd}
                      onSelect={(d) => d && setCustomEnd(d)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedClassId ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <CalendarIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Select a class</h2>
          <p className="text-sm text-muted-foreground">Choose a class to view attendance trends</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !data?.records.length ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <XCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No attendance data</h2>
          <p className="text-sm text-muted-foreground">
            No attendance records found for {format(dateRange.start, 'dd/MM/yyyy')} – {format(dateRange.end, 'dd/MM/yyyy')}
          </p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" /> Attendance Rate
                </div>
                <p className="text-2xl font-bold text-foreground">{overallStats.rate}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Users className="h-4 w-4" /> Total Records
                </div>
                <p className="text-2xl font-bold text-foreground">{overallStats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Present</div>
                <p className="text-2xl font-bold text-success">{overallStats.present}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Absent</div>
                <p className="text-2xl font-bold text-destructive">{overallStats.absent}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Late</div>
                <p className="text-2xl font-bold text-warning">{overallStats.late}</p>
              </CardContent>
            </Card>
          </div>

          {/* Trend Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Daily Attendance Trend</CardTitle>
              <Button variant="outline" onClick={handleExportPdf} className="gap-2">
                <FileDown className="h-4 w-4" /> Export PDF
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs fill-muted-foreground" />
                    <YAxis className="text-xs fill-muted-foreground" />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="present" stackId="1" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.6} name="Present" />
                    <Area type="monotone" dataKey="late" stackId="1" stroke="hsl(var(--warning))" fill="hsl(var(--warning))" fillOpacity={0.6} name="Late" />
                    <Area type="monotone" dataKey="excused" stackId="1" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" fillOpacity={0.6} name="Excused" />
                    <Area type="monotone" dataKey="absent" stackId="1" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.6} name="Absent" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Rate Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Attendance Rate (%)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs fill-muted-foreground" />
                    <YAxis domain={[0, 100]} className="text-xs fill-muted-foreground" />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      formatter={(value: number) => [`${value}%`, 'Rate']}
                    />
                    <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Rate" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Student Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Student Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead className="text-center">Excused</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.studentSummaries.map((s, i) => {
                    const cls = classes?.find(c => c.id === selectedClassId);
                    const studentRecords = data.records
                      .filter(r => r.student_id === s.student_id)
                      .map(r => ({ date: r.date, status: r.status as AttendanceStatus }));
                    
                    const reportData = {
                      studentName: s.student_name,
                      className: cls?.name || '',
                      classGrade: cls?.grade,
                      classSection: cls?.section,
                      teacherName: (cls as any)?.teacher?.profile?.full_name,
                      dateRange: { start: dateRange.start, end: dateRange.end },
                      records: studentRecords,
                    };

                    return (
                      <TableRow key={s.student_id}>
                        <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                        <TableCell className="font-medium">{s.student_name}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="border-success/50 bg-success/10 text-success">{s.present}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive">{s.absent}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="border-warning/50 bg-warning/10 text-warning">{s.late}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="border-muted-foreground/50 bg-muted text-muted-foreground">{s.excused}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={s.rate} className="h-2 flex-1" />
                            <span className={cn(
                              "text-sm font-medium w-10 text-right",
                              s.rate >= 90 ? "text-success" : s.rate >= 75 ? "text-warning" : "text-destructive"
                            )}>
                              {s.rate}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => downloadStudentAttendancePdf(reportData)}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download PDF</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                                  onClick={() => shareStudentAttendanceViaWhatsApp(reportData, parentPhones?.[s.student_id])}
                                >
                                  <Share2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Share via WhatsApp</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
