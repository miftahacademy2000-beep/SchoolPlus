import {
  Building2,
  Users,
  GraduationCap,
  School as SchoolIcon,
  UserRound,
  BookOpen,
  Receipt,
  Wallet,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  Plus,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { StatCard, ChartCard, SchoolCard, SchoolInquiriesSection } from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import { useSuperAdminDashboard } from '@/hooks/useSuperAdminDashboard';
import { useNavigate } from 'react-router-dom';
import { School } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ReactNode } from 'react';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading, error, refetch } = useSuperAdminDashboard();
  const { data: health } = useQuery({
    queryKey: ['platform-api-health'],
    queryFn: async () => api.get<{ status: string; timestamp: string }>('/health'),
    refetchInterval: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96 max-w-full" /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>
          <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !stats) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">Dashboard data is unavailable</h2>
          <p className="max-w-md text-sm text-muted-foreground">{error instanceof Error ? error.message : 'The platform metrics API did not return data. No placeholder values are shown.'}</p>
          <Button variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
        </div>
      </DashboardLayout>
    );
  }

  // Transform recent schools for SchoolCard component
  const recentSchoolsForCards: School[] = stats.recentSchools.map(school => ({
    id: school.id,
    name: school.name,
    slug: school.slug,
    email: school.email || '',
    status: school.status.toUpperCase() as 'ACTIVE' | 'PENDING' | 'SUSPENDED',
    plan: school.plan.toUpperCase() as 'FREE' | 'PRO' | 'ENTERPRISE',
    studentCount: school.studentCount,
    teacherCount: school.teacherCount,
    createdAt: school.createdAt,
    updatedAt: school.createdAt,
  }));

  return (
    <DashboardLayout>
      <PageHeader
        title="Platform Overview"
        description="Welcome back! Here's what's happening across your platform."
        breadcrumbs={[{ label: 'Dashboard' }]}
        actions={
          <Button className="gap-2" onClick={() => navigate('/schools')}>
            <Plus className="h-4 w-4" />
            Add School
          </Button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Schools"
          value={stats.totals.totalSchools.toLocaleString()}
          changeLabel={`${stats.totals.inactiveSchools.toLocaleString()} inactive`}
          icon={<Building2 className="h-6 w-6" />}
          color="primary"
          delay={0}
        />
        <StatCard
          title="Platform Users"
          value={stats.totals.totalUsers.toLocaleString()}
          changeLabel={`${stats.totals.activeUsers.toLocaleString()} active members`}
          icon={<Users className="h-6 w-6" />}
          color="success"
          delay={0.1}
        />
        <StatCard
          title="Total Students"
          value={stats.totals.totalStudents.toLocaleString()}
          changeLabel="not archived"
          icon={<GraduationCap className="h-6 w-6" />}
          color="student"
          delay={0.2}
        />
        <StatCard
          title="Total Teachers"
          value={stats.totals.totalTeachers.toLocaleString()}
          changeLabel="not archived"
          icon={<Users className="h-6 w-6" />}
          color="super-admin"
          delay={0.3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <StatCard title="Total Classes" value={stats.totals.totalClasses.toLocaleString()} changeLabel="across schools" icon={<SchoolIcon className="h-6 w-6" />} color="info" />
        <StatCard title="Total Courses" value={stats.totals.totalCourses.toLocaleString()} changeLabel="across schools" icon={<BookOpen className="h-6 w-6" />} color="teacher" />
        <StatCard title="Parents / Guardians" value={stats.totals.totalParents.toLocaleString()} changeLabel="not archived" icon={<UserRound className="h-6 w-6" />} color="warning" />
        <StatCard title="Total Invoices" value={stats.totals.totalInvoices.toLocaleString()} changeLabel={`${stats.totals.paidInvoices.toLocaleString()} paid`} icon={<Receipt className="h-6 w-6" />} color="primary" />
        <StatCard title="Active Subscriptions" value={stats.totals.activeSubscriptions.toLocaleString()} changeLabel="paid, current period" icon={<CreditCard className="h-6 w-6" />} color="success" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <ChartCard
          title="School Growth"
          subtitle="Monthly school registrations"
          className="lg:col-span-2"
          delay={0.4}
        >
          <div className="h-80">
            {stats.monthlyStats.some((item) => item.schools > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlyStats}>
                <defs>
                  <linearGradient id="schoolsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value} schools`, 'Registered']}
                />
                <Area
                  type="monotone"
                  dataKey="schools"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#schoolsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
            ) : <ChartEmpty message="No school registrations in this period" />}
          </div>
        </ChartCard>

        <ChartCard
          title="Plan Distribution"
          subtitle="Schools by plan type"
          delay={0.5}
        >
          <div className="h-80 flex flex-col items-center justify-center">
            {stats.planDistribution.length > 0 ? <>
            <ResponsiveContainer width="100%" height="70%">
              <PieChart>
                <Pie
                  data={stats.planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value} schools`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              {stats.planDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}: {item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
            </> : <ChartEmpty message="No school plan data available" />}
          </div>
        </ChartCard>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <div className="bg-success/10 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-success" />
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.totals.activeSchools}</p>
            <p className="text-xs text-muted-foreground">Active Schools</p>
          </div>
        </div>
        <div className="bg-warning/10 rounded-xl p-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-warning" />
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.totals.pendingSchools}</p>
            <p className="text-xs text-muted-foreground">Pending Approval</p>
          </div>
        </div>
        <div className="bg-destructive/10 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.totals.suspendedSchools}</p>
            <p className="text-xs text-muted-foreground">Suspended</p>
          </div>
        </div>
        <div className="bg-primary/10 rounded-xl p-4 flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.totals.unpaidInvoices}</p>
            <p className="text-xs text-muted-foreground">Unpaid / Overdue invoices</p>
          </div>
        </div>
        <div className="bg-info/10 rounded-xl p-4 flex items-center gap-3">
          <Building2 className="h-8 w-8 text-info" />
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.totals.pendingInquiries.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Pending inquiries</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <ChartCard title="Student Growth" subtitle="Real student registrations/enrollment dates by month">
          <div className="h-72">{stats.monthlyStats.some((item) => item.students > 0) ? <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.monthlyStats}>
              <defs><linearGradient id="studentsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip />
              <Area type="monotone" dataKey="students" name="Students" stroke="hsl(var(--chart-2))" fill="url(#studentsGradient)" />
            </AreaChart>
          </ResponsiveContainer> : <ChartEmpty message="No student registrations in this period" />}</div>
        </ChartCard>
        <ChartCard title="Revenue Overview" subtitle="Recorded invoice and subscription payments; grouped by currency">
          <div className="h-72">{stats.monthlyStats.some((item) => Object.values(item.revenue).some((amount) => amount > 0)) ? <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.monthlyStats}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
              {Array.from(new Set(stats.monthlyStats.flatMap((item) => Object.keys(item.revenue)))).map((currency, index) => <Line key={currency} type="monotone" dataKey={`revenue.${currency}`} name={currency} stroke={['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'][index % 3]} strokeWidth={2} />)}
            </LineChart>
          </ResponsiveContainer> : <ChartEmpty message="No payments recorded in this period" />}</div>
        </ChartCard>
      </div>

      <ChartCard title="Financial Summary" subtitle="Collected payments and remaining invoice balances, grouped by actual invoice currency" className="mb-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <FinancialTotals title="Invoice payments received" values={stats.financials.invoicePaymentsReceived} icon={<Wallet className="h-5 w-5 text-success" />} />
          <FinancialTotals title="Outstanding invoice balance" values={stats.financials.outstandingBalance} icon={<Clock className="h-5 w-5 text-warning" />} />
          <div className="rounded-lg border border-border p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard className="h-5 w-5 text-primary" />Subscription payments received</div><p className="mt-3 text-2xl font-semibold">{new Intl.NumberFormat(undefined, { style: 'currency', currency: stats.financials.subscriptionCurrency }).format(stats.financials.subscriptionPaymentsReceived)}</p></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-muted-foreground"><span>{stats.totals.paidInvoices.toLocaleString()} paid</span><span>·</span><span>{stats.totals.pendingInvoices.toLocaleString()} pending</span><span>·</span><span>{stats.totals.overdueInvoices.toLocaleString()} overdue</span></div>
      </ChartCard>

      {/* School Inquiries */}
      <div className="mb-8">
        <SchoolInquiriesSection />
      </div>

      <ChartCard title="Recent Platform Activity" subtitle="Latest schools, users, invoices, and recorded payments" className="mb-8" actions={<div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${health?.status === 'ok' ? 'bg-success' : 'bg-destructive'}`} />API {health?.status === 'ok' ? 'operational' : 'status unavailable'}</div>}>
        {stats.recentActivity.length ? <div className="divide-y divide-border">{stats.recentActivity.map((event) => <div key={event.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-sm font-medium">{event.title}</p><p className="text-sm text-muted-foreground">{event.description}</p></div></div><div className="flex items-center gap-3 pl-7 text-xs text-muted-foreground sm:pl-0">{event.amount !== undefined && <span className="font-medium text-foreground">{event.currency} {event.amount.toLocaleString()}</span>}<time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></div></div>)}</div> : <div className="py-10 text-center text-sm text-muted-foreground">No recent platform activity</div>}
      </ChartCard>

      {/* Recent Schools */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Schools</h2>
          <Button variant="ghost" size="sm" className="gap-1 text-primary" onClick={() => navigate('/schools')}>
            View all <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        {recentSchoolsForCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentSchoolsForCards.slice(0, 3).map((school, index) => (
              <SchoolCard key={school.id} school={school} delay={0.6 + index * 0.1} />
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No schools registered yet</p>
            <Button className="mt-4" onClick={() => navigate('/schools')}>
              Add First School
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><TrendingUp className="h-8 w-8 opacity-40" /><span>{message}</span></div>;
}

function FinancialTotals({ title, values, icon }: { title: string; values: Array<{ currency: string; amount: number }>; icon: ReactNode }) {
  return <div className="rounded-lg border border-border p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{title}</div>{values.length ? values.map(({ currency, amount }) => <p key={currency} className="mt-3 text-2xl font-semibold">{new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)}</p>) : <p className="mt-3 text-sm text-muted-foreground">No recorded amount</p>}</div>;
}
