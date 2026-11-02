import { useMemo, useState } from 'react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { extractStudentIdNum } from '@/lib/studentSorting';
import { getOutstandingBalance } from '@/lib/invoiceFinancials';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, TrendingDown, Download, AlertCircle, X, BarChart3, TableIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Invoice {
  id: string;
  amount: number;
  amount_paid?: number;
  amount_waived?: number;
  status: string;
  due_date: string;
  student_id: string;
  title: string;
  description: string | null;
  student?: {
    id: string;
    grade: string | null;
    enrollment_number: string | null;
    profile: {
      full_name: string | null;
    } | null;
  } | null;
}

interface StudentMonthData {
  month: string; // "YYYY-MM"
  label: string; // "Mar 2026"
  totalDue: number;
  paidAmount: number;
  unpaid: number;
  hasCarryForward: boolean;
}

interface StudentCarryForwardHistory {
  studentId: string;
  name: string;
  enrollmentNumber: string | null;
  grade: string | null;
  months: StudentMonthData[];
  consecutiveUnpaidMonths: number;
  totalUnpaid: number;
  currentStreak: number;
}

interface CarryForwardReportProps {
  invoices: Invoice[];
}

export function CarryForwardReport({ invoices }: CarryForwardReportProps) {
  const [search, setSearch] = useState('');
  const [monthRange, setMonthRange] = useState<'3' | '6' | '12'>('6');
  const [sortBy, setSortBy] = useState<'streak' | 'amount'>('streak');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [sectionOpen, setSectionOpen] = useState(false);

  // Generate the list of months to display
  const months = useMemo(() => {
    const count = parseInt(monthRange);
    const now = new Date();
    const result: { key: string; label: string; start: Date; end: Date }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      const s = startOfMonth(d);
      const e = endOfMonth(d);
      result.push({
        key: format(s, 'yyyy-MM'),
        label: format(s, 'MMM yyyy'),
        start: s,
        end: e,
      });
    }
    return result;
  }, [monthRange]);

  // Build carry-forward history per student
  const studentHistories = useMemo(() => {
    // Group invoices by student
    const studentMap = new Map<string, {
      name: string;
      enrollmentNumber: string | null;
      grade: string | null;
      invoices: Invoice[];
    }>();

    for (const inv of invoices) {
      if (!inv.student_id) continue;
      if (!studentMap.has(inv.student_id)) {
        studentMap.set(inv.student_id, {
          name: inv.student?.profile?.full_name || 'Unknown',
          enrollmentNumber: inv.student?.enrollment_number || null,
          grade: inv.student?.grade || null,
          invoices: [],
        });
      }
      studentMap.get(inv.student_id)!.invoices.push(inv);
    }

    const histories: StudentCarryForwardHistory[] = [];

    for (const [studentId, data] of studentMap) {
      const monthsData: StudentMonthData[] = [];
      let consecutiveUnpaid = 0;
      let maxConsecutive = 0;
      let currentStreak = 0;

      for (const m of months) {
        const monthInvoices = data.invoices.filter((inv) => {
          const due = new Date(inv.due_date + 'T00:00:00');
          return isWithinInterval(due, { start: m.start, end: m.end });
        });

        const totalDue = monthInvoices.reduce(
          (sum, invoice) => sum + Number(invoice.amount) - Number(invoice.amount_waived || 0),
          0,
        );
        const paidAmount = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid || 0), 0);
        const unpaid = monthInvoices.reduce((sum, invoice) => sum + getOutstandingBalance(invoice), 0);
        const hasCarryForward = monthInvoices.some(
          (i) => i.description?.includes('Carry-forward') || i.title?.includes('carry-forward')
        );

        monthsData.push({
          month: m.key,
          label: m.label,
          totalDue,
          paidAmount,
          unpaid: Math.max(0, unpaid),
          hasCarryForward,
        });

        if (unpaid > 0) {
          consecutiveUnpaid++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveUnpaid);
        } else if (totalDue > 0) {
          consecutiveUnpaid = 0;
        }
      }

      // Calculate current streak (from most recent month backwards)
      currentStreak = 0;
      for (let i = monthsData.length - 1; i >= 0; i--) {
        if (monthsData[i].unpaid > 0) {
          currentStreak++;
        } else if (monthsData[i].totalDue > 0) {
          break;
        }
      }

      const totalUnpaid = monthsData.reduce((s, m) => s + m.unpaid, 0);

      // Only include students who have at least 1 month of unpaid balance
      if (maxConsecutive >= 1 && totalUnpaid > 0) {
        histories.push({
          studentId,
          name: data.name,
          enrollmentNumber: data.enrollmentNumber,
          grade: data.grade,
          months: monthsData,
          consecutiveUnpaidMonths: maxConsecutive,
          totalUnpaid,
          currentStreak,
        });
      }
    }

    // Sort by Student ID numerically, then by secondary sort criteria
    histories.sort((a, b) => {
      const numA = extractStudentIdNum(a.enrollmentNumber);
      const numB = extractStudentIdNum(b.enrollmentNumber);
      return numA - numB;
    });

    return histories;
  }, [invoices, months, sortBy]);

  const filtered = studentHistories.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.enrollmentNumber?.toLowerCase().includes(q)
    );
  });

  // Chart data: each month as a data point, with per-student unpaid amounts
  const CHART_COLORS = [
    'hsl(var(--destructive))',
    'hsl(var(--primary))',
    'hsl(210, 70%, 50%)',
    'hsl(30, 80%, 55%)',
    'hsl(280, 60%, 55%)',
    'hsl(160, 60%, 45%)',
    'hsl(350, 70%, 50%)',
    'hsl(45, 80%, 50%)',
  ];

  // Top students for chart (limit to 8 for readability)
  const topStudents = filtered.slice(0, 8);

  const chartData = useMemo(() => {
    return months.map((m) => {
      const point: Record<string, string | number> = { month: m.label };
      for (const student of topStudents) {
        const monthData = student.months.find((md) => md.month === m.key);
        point[student.name] = monthData?.unpaid || 0;
      }
      return point;
    });
  }, [months, topStudents]);

  const getStreakBadge = (streak: number) => {
    if (streak >= 3) return { label: `${streak} months`, className: 'bg-destructive/10 text-destructive border-destructive/20' };
    if (streak >= 2) return { label: `${streak} months`, className: 'bg-warning/10 text-warning border-warning/20' };
    return { label: `${streak} month`, className: 'bg-muted text-muted-foreground' };
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const handleExportCsv = () => {
    const headers = ['Student ID', 'Name', 'Grade', 'Current Streak', 'Total Unpaid', ...months.map((m) => m.label)];
    const rows = filtered.map((s) => [
      s.enrollmentNumber || '',
      s.name,
      s.grade || '',
      String(s.currentStreak),
      `$${s.totalUnpaid.toFixed(2)}`,
      ...s.months.map((m) => m.unpaid > 0 ? `$${m.unpaid.toFixed(2)}` : m.totalDue > 0 ? 'Paid' : '-'),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carry-forward-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mb-6">
      <button
        onClick={() => setSectionOpen((o) => !o)}
        className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors mb-4"
      >
        <div className="flex items-center gap-2">
          {sectionOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <TrendingDown className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Carry-Forward History</h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="destructive" className="text-sm gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {filtered.filter((s) => s.currentStreak >= 2).length} recurring defaulters
          </Badge>
          <Badge variant="outline" className="text-sm">
            {filtered.length} students with unpaid history
          </Badge>
        </div>
      </button>

      {sectionOpen && (<>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={monthRange} onValueChange={(v) => setMonthRange(v as '3' | '6' | '12')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Last 3 months</SelectItem>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'streak' | 'amount')}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="streak">Sort by streak</SelectItem>
            <SelectItem value="amount">Sort by amount</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCsv}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'chart' | 'table')}>
          <TabsList className="h-8">
            <TabsTrigger value="chart" className="gap-1.5 text-xs px-3">
              <BarChart3 className="h-3.5 w-3.5" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5 text-xs px-3">
              <TableIcon className="h-3.5 w-3.5" />
              Table
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {studentHistories.length === 0
              ? 'No students with recurring unpaid balances — great news! 🎉'
              : 'No matching students found.'}
          </CardContent>
        </Card>
      ) : viewMode === 'chart' ? (
        <ChartCard
          title="Unpaid Balance Trends"
          subtitle={`Top ${topStudents.length} students by ${sortBy === 'streak' ? 'streak length' : 'total unpaid'}`}
        >
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {topStudents.map((student, i) => (
                  <Line
                    key={student.studentId}
                    type="monotone"
                    dataKey={student.name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ) : (
        <Card>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10 min-w-[200px]">Student</TableHead>
                  <TableHead className="text-center w-[100px]">Streak</TableHead>
                  <TableHead className="text-right w-[110px]">Total Unpaid</TableHead>
                  {months.map((m) => (
                    <TableHead key={m.key} className="text-center min-w-[90px]">
                      {m.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((student) => {
                  const streakBadge = getStreakBadge(student.currentStreak);
                  return (
                    <TableRow key={student.studentId}>
                      <TableCell className="sticky left-0 bg-card z-10">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 border border-border">
                            <AvatarFallback
                              className={cn(
                                'text-[10px] font-medium',
                                student.currentStreak >= 2
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {getInitials(student.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {student.enrollmentNumber && (
                                <span className="font-mono text-primary mr-1">
                                  {student.enrollmentNumber}
                                </span>
                              )}
                              {student.name}
                            </p>
                            {student.grade && (
                              <p className="text-[10px] text-muted-foreground">Grade {student.grade}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn('text-[10px]', streakBadge.className)}>
                          {streakBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-sm text-destructive">
                          ${student.totalUnpaid.toLocaleString()}
                        </span>
                      </TableCell>
                      {student.months.map((m) => (
                        <TableCell key={m.month} className="text-center">
                          {m.totalDue === 0 ? (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          ) : m.unpaid > 0 ? (
                            <div>
                              <span className={cn(
                                'text-xs font-semibold',
                                m.hasCarryForward ? 'text-destructive' : 'text-warning'
                              )}>
                                ${m.unpaid.toLocaleString()}
                              </span>
                              {m.hasCarryForward && (
                                <p className="text-[9px] text-destructive/70">+carry</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-success font-medium">✓ Paid</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
      </>)}
    </div>
  );
}
