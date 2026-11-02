import { useNavigate } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  UserPlus,
  Loader2,
  School,
  Users2,
  DollarSign,
  Receipt,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { StatCard, ChartCard, DataTable } from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSchoolDashboard } from '@/hooks/useSchoolDashboard';
import { format } from 'date-fns';

export default function SchoolAdminDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useSchoolDashboard();

  const recentStudents = stats?.recentStudents || [];

  const studentColumns = [
    {
      key: 'name',
      header: 'Student',
      cell: (student: typeof recentStudents[0]) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{student.name}</span>
        </div>
      ),
    },
    {
      key: 'grade',
      header: 'Grade',
      cell: (student: typeof recentStudents[0]) => (
        <span className="text-muted-foreground">{student.grade || 'N/A'}</span>
      ),
    },
    {
      key: 'enrolledAt',
      header: 'Enrolled',
      cell: (student: typeof recentStudents[0]) => (
        <span className="text-muted-foreground">
          {format(new Date(student.enrolledAt), 'MMM d, yyyy')}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="School Dashboard"
        description={`${stats?.schoolName || 'Your School'} - Manage your school efficiently`}
        breadcrumbs={[{ label: 'Dashboard' }]}
        actions={
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => navigate('/schedule')}>
              <Calendar className="h-4 w-4" />
              Schedule
            </Button>
            <Button className="gap-2" onClick={() => navigate('/students')}>
              <UserPlus className="h-4 w-4" />
              Add Student
            </Button>
          </div>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard
          title="Students"
          value={(stats?.studentCount ?? 0).toLocaleString()}
          icon={<GraduationCap className="h-5 w-5" />}
          trend="neutral"
          color="student"
          delay={0}
        />
        <StatCard
          title="Teachers"
          value={(stats?.teacherCount ?? 0).toLocaleString()}
          icon={<Users className="h-5 w-5" />}
          trend="neutral"
          color="teacher"
          delay={0.05}
        />
        <StatCard
          title="Parents"
          value={(stats?.parentCount ?? 0).toLocaleString()}
          icon={<Users2 className="h-5 w-5" />}
          trend="neutral"
          color="warning"
          delay={0.1}
        />
        <StatCard
          title="Classes"
          value={(stats?.classCount ?? 0).toLocaleString()}
          icon={<School className="h-5 w-5" />}
          trend="neutral"
          color="info"
          delay={0.15}
        />
        <StatCard
          title="Courses"
          value={(stats?.courseCount ?? 0).toLocaleString()}
          icon={<BookOpen className="h-5 w-5" />}
          trend="neutral"
          color="primary"
          delay={0.2}
        />
        <StatCard
          title="Attendance"
          value={stats?.attendanceRate ? `${stats.attendanceRate}%` : 'N/A'}
          icon={<CheckCircle2 className="h-5 w-5" />}
          trend={stats?.attendanceRate && stats.attendanceRate >= 90 ? 'up' : 'neutral'}
          color="success"
          delay={0.25}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ChartCard
          title="Weekly Attendance"
          subtitle="Average attendance rate by day"
          delay={0.4}
        >
          <div className="h-64">
            {stats?.weeklyAttendance && stats.weeklyAttendance.some(d => d.attendance > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weeklyAttendance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Attendance']}
                  />
                  <Bar
                    dataKey="attendance"
                    fill="hsl(var(--success))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-2" />
                <p>No attendance data this week</p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => navigate('/attendance')}
                >
                  Mark Attendance
                </Button>
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard
          title="Quick Overview"
          subtitle="School statistics at a glance"
          delay={0.5}
        >
          <div className="h-64 flex flex-col justify-center space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-student/10">
                  <GraduationCap className="h-5 w-5 text-student" />
                </div>
                <span className="font-medium">Students</span>
              </div>
              <span className="text-2xl font-bold">{stats?.studentCount || 0}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teacher/10">
                  <Users className="h-5 w-5 text-teacher" />
                </div>
                <span className="font-medium">Teachers</span>
              </div>
              <span className="text-2xl font-bold">{stats?.teacherCount || 0}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium">Courses</span>
              </div>
              <span className="text-2xl font-bold">{stats?.courseCount || 0}</span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Invoice Analytics */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Invoice & Fee Analytics</h2>
          <Button variant="ghost" size="sm" className="gap-1 text-primary" onClick={() => navigate('/invoices')}>
            View all <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-success/10 rounded-xl p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-success" />
            <div>
              <p className="text-xl font-bold text-foreground">${(stats?.invoiceStats?.paidAmount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Paid</p>
            </div>
          </div>
          <div className="bg-warning/10 rounded-xl p-4 flex items-center gap-3">
            <Receipt className="h-8 w-8 text-warning" />
            <div>
              <p className="text-xl font-bold text-foreground">${(stats?.invoiceStats?.pendingAmount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
          <div className="bg-destructive/10 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xl font-bold text-foreground">${(stats?.invoiceStats?.overdueAmount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </div>
          <div className="bg-primary/10 rounded-xl p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xl font-bold text-foreground">${(stats?.invoiceStats?.totalAmount ?? 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total ({stats?.invoiceStats?.invoiceCount ?? 0})</p>
            </div>
          </div>
        </div>

        {/* Payment Reminder Summary Widget */}
        {((stats?.invoiceStats?.overdueCount ?? 0) > 0 || (stats?.invoiceStats?.carryForwardCount ?? 0) > 0) && (
          <div className="bg-card border border-destructive/20 rounded-xl p-5 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Payment Reminders</h3>
                  <p className="text-sm text-muted-foreground">Students with outstanding balances</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => navigate('/invoices')}>
                View Details <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                className="bg-destructive/5 rounded-lg p-4 border border-destructive/10 cursor-pointer hover:bg-destructive/10 transition-colors"
                onClick={() => navigate('/invoices?status=overdue')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">Overdue Invoices</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats?.invoiceStats?.overdueCount ?? 0}</p>
                <p className="text-sm text-muted-foreground">${(stats?.invoiceStats?.overdueAmount ?? 0).toLocaleString()} total</p>
              </div>
              <div
                className="bg-warning/5 rounded-lg p-4 border border-warning/10 cursor-pointer hover:bg-warning/10 transition-colors"
                onClick={() => navigate('/invoices?status=pending')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium text-warning">Carry-Forward</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats?.invoiceStats?.carryForwardCount ?? 0}</p>
                <p className="text-sm text-muted-foreground">${(stats?.invoiceStats?.carryForwardAmount ?? 0).toLocaleString()} unpaid</p>
              </div>
              <div
                className="bg-muted/50 rounded-lg p-4 border border-border cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate('/invoices?status=overdue')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Total Outstanding</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  ${((stats?.invoiceStats?.overdueAmount ?? 0) + (stats?.invoiceStats?.pendingAmount ?? 0)).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {(stats?.invoiceStats?.overdueCount ?? 0) + (stats?.invoiceStats?.carryForwardCount ?? 0)} students affected
                </p>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="monthly" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="monthly">Monthly Trend</TabsTrigger>
            <TabsTrigger value="yearly">Yearly Trend</TabsTrigger>
          </TabsList>
          <TabsContent value="monthly">
            <ChartCard title="Monthly Invoice Trends" subtitle="Last 6 months fee collection" delay={0.6}>
              <div className="h-72">
                {stats?.invoiceStats?.monthlyTrend ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.invoiceStats.monthlyTrend}>
                      <defs>
                        <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="pendingGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="overdueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="paid" stroke="hsl(var(--success))" fill="url(#paidGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="pending" stroke="hsl(var(--warning))" fill="url(#pendingGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="overdue" stroke="hsl(var(--destructive))" fill="url(#overdueGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Receipt className="h-12 w-12 mb-2" />
                    <p>No invoice data available</p>
                    <Button variant="link" className="mt-2" onClick={() => navigate('/invoices')}>Create Invoice</Button>
                  </div>
                )}
              </div>
            </ChartCard>
          </TabsContent>
          <TabsContent value="yearly">
            <ChartCard title="Yearly Invoice Trends" subtitle="Annual fee collection comparison" delay={0.6}>
              <div className="h-72">
                {stats?.invoiceStats?.yearlyTrend ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.invoiceStats.yearlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                      />
                      <Legend />
                      <Bar dataKey="paid" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pending" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="overdue" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Receipt className="h-12 w-12 mb-2" />
                    <p>No invoice data available</p>
                    <Button variant="link" className="mt-2" onClick={() => navigate('/invoices')}>Create Invoice</Button>
                  </div>
                )}
              </div>
            </ChartCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2"
          onClick={() => navigate('/students')}
        >
          <GraduationCap className="h-6 w-6 text-student" />
          <span>Manage Students</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2"
          onClick={() => navigate('/teachers')}
        >
          <Users className="h-6 w-6 text-teacher" />
          <span>Manage Teachers</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2"
          onClick={() => navigate('/courses')}
        >
          <BookOpen className="h-6 w-6 text-primary" />
          <span>View Courses</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex flex-col gap-2"
          onClick={() => navigate('/schedule')}
        >
          <Calendar className="h-6 w-6 text-info" />
          <span>Timetables</span>
        </Button>
      </div>

      {/* Recent Students */}
      <div className="grid grid-cols-1 gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Enrollments</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1 text-primary"
              onClick={() => navigate('/students')}
            >
              View all <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          {recentStudents.length > 0 ? (
            <DataTable
              columns={studentColumns}
              data={recentStudents}
            />
          ) : (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No students yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first student to get started
              </p>
              <Button onClick={() => navigate('/students')}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Student
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
