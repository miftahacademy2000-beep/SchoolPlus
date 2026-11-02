import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  BarChart3,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAttendanceAnalytics, type TrendView } from '@/hooks/useAttendanceAnalytics';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { exportAttendanceAnalyticsPdf } from '@/lib/attendanceAnalyticsExport';
import { toast } from '@/hooks/use-toast';

export default function AttendanceAnalytics() {
  const { t } = useTranslation();
  const [trendView, setTrendView] = useState<TrendView>('monthly');
  const { data, isLoading } = useAttendanceAnalytics(trendView);
  const { currentSchoolId } = useSchoolContext();

  const handleExportPdf = () => {
    if (!data || data.totalRecords === 0) return;
    try {
      exportAttendanceAnalyticsPdf(data, {
        trendView,
      });
      toast({ title: t('attendance.analytics.exportSuccess', 'Report exported successfully') });
    } catch {
      toast({ title: t('attendance.analytics.exportError', 'Failed to export report'), variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.totalRecords === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {t('attendance.analytics.noData', 'No attendance data yet')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('attendance.analytics.noDataDesc', 'Start recording attendance to see analytics and trends here.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExportPdf}>
          <Download className="h-4 w-4 mr-2" />
          {t('attendance.analytics.exportPdf', 'Export PDF')}
        </Button>
      </div>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              {t('attendance.analytics.overallRate', 'Overall Rate')}
            </div>
            <p className={cn(
              "text-2xl font-bold",
              data.overallRate >= 90 ? "text-success" : data.overallRate >= 75 ? "text-warning" : "text-destructive"
            )}>
              {data.overallRate}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              {t('attendance.analytics.totalRecords', 'Total Records')}
            </div>
            <p className="text-2xl font-bold text-foreground">{data.totalRecords.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CheckCircle2 className="h-4 w-4 text-success" />
              {t('attendance.status.present')}
            </div>
            <p className="text-2xl font-bold text-success">{data.totalPresent.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <XCircle className="h-4 w-4 text-destructive" />
              {t('attendance.status.absent')}
            </div>
            <p className="text-2xl font-bold text-destructive">{data.totalAbsent.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-warning" />
              {t('attendance.status.late')}
            </div>
            <p className="text-2xl font-bold text-warning">{data.totalLate.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              {t('attendance.status.excused')}
            </div>
            <p className="text-2xl font-bold text-muted-foreground">{data.totalExcused.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Rate Trend */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('attendance.analytics.rateTrend', 'Attendance Rate Trend')}</CardTitle>
          <Select value={trendView} onValueChange={(v) => setTrendView(v as TrendView)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">{t('attendance.analytics.weekly', 'Weekly')}</SelectItem>
              <SelectItem value="monthly">{t('attendance.analytics.monthly', 'Monthly')}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" className="text-xs fill-muted-foreground" />
                <YAxis domain={[0, 100]} className="text-xs fill-muted-foreground" tickFormatter={(v) => `${v}%`} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: number) => [`${value}%`, t('attendance.analytics.rate', 'Rate')]}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                  name={t('attendance.analytics.rate', 'Rate')}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown Over Time */}
      <Card>
        <CardHeader>
          <CardTitle>{t('attendance.analytics.statusBreakdown', 'Status Breakdown Over Time')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" className="text-xs fill-muted-foreground" />
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
                <Area type="monotone" dataKey="present" stackId="1" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.6} name={t('attendance.status.present')} />
                <Area type="monotone" dataKey="late" stackId="1" stroke="hsl(var(--warning))" fill="hsl(var(--warning))" fillOpacity={0.6} name={t('attendance.status.late')} />
                <Area type="monotone" dataKey="excused" stackId="1" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" fillOpacity={0.6} name={t('attendance.status.excused')} />
                <Area type="monotone" dataKey="absent" stackId="1" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.6} name={t('attendance.status.absent')} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Day-of-Week Patterns */}
      {data.dayOfWeekPatterns && data.dayOfWeekPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('attendance.analytics.dayOfWeek', 'Day-of-Week Attendance Patterns')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dayOfWeekPatterns}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs fill-muted-foreground" />
                  <YAxis domain={[0, 100]} className="text-xs fill-muted-foreground" tickFormatter={(v) => `${v}%`} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'rate') return [`${value}%`, t('attendance.analytics.rate', 'Rate')];
                      return [value, name];
                    }}
                  />
                  <Bar
                    dataKey="rate"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name={t('attendance.analytics.rate', 'Rate')}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {(() => {
              const lowest = data.dayOfWeekPatterns.reduce((min, d) => d.rate < min.rate ? d : min, data.dayOfWeekPatterns[0]);
              const highest = data.dayOfWeekPatterns.reduce((max, d) => d.rate > max.rate ? d : max, data.dayOfWeekPatterns[0]);
              return (
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive">
                      {t('attendance.analytics.lowestDay', 'Lowest')}: {lowest.label} ({lowest.rate}%)
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-success/50 bg-success/10 text-success">
                      {t('attendance.analytics.highestDay', 'Highest')}: {highest.label} ({highest.rate}%)
                    </Badge>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Class Comparison */}
      {data.classSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('attendance.analytics.classComparison', 'Class Attendance Comparison')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>{t('attendance.analytics.className', 'Class')}</TableHead>
                  <TableHead className="text-center">{t('attendance.analytics.totalRecords', 'Total Records')}</TableHead>
                  <TableHead className="text-center">{t('attendance.status.present')}</TableHead>
                  <TableHead className="text-center">{t('attendance.status.absent')}</TableHead>
                  <TableHead>{t('attendance.analytics.rate', 'Rate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.classSummaries.map((cls, i) => (
                  <TableRow key={cls.class_id}>
                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                    <TableCell className="font-medium">
                      {cls.class_name}
                      {cls.grade && <span className="text-muted-foreground ml-1">- {cls.grade}</span>}
                      {cls.section && <span className="text-muted-foreground ml-1">({cls.section})</span>}
                    </TableCell>
                    <TableCell className="text-center">{cls.total_records}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-success/50 bg-success/10 text-success">{cls.present}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive">{cls.absent}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={cls.rate} className="h-2 flex-1" />
                        <span className={cn(
                          "text-sm font-medium w-10 text-right",
                          cls.rate >= 90 ? "text-success" : cls.rate >= 75 ? "text-warning" : "text-destructive"
                        )}>
                          {cls.rate}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
