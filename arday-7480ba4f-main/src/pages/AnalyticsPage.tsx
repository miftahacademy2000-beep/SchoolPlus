import { DashboardLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  Building2, 
  Users, 
  GraduationCap, 
  BookOpen, 
  TrendingUp, 
  Calendar,
  UserCheck,
  Loader2,
  School,
  ClipboardCheck,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { format } from 'date-fns';

interface PlatformStats {
  totalSchools: number;
  activeSchools: number;
  pendingSchools: number;
  suspendedSchools: number;
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  totalCourses: number;
  totalClasses: number;
  schoolsByPlan: { name: string; value: number }[];
  recentSchools: { id: string; name: string; status: string; createdAt: string }[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

function usePlatformAnalytics() {
  return useQuery({
    queryKey: ['platform-analytics'],
    queryFn: async (): Promise<PlatformStats> => {
      const { data } = await api.get<{ data: {
        totals: Omit<PlatformStats, 'schoolsByPlan' | 'recentSchools'> & { inactiveSchools: number };
        planDistribution: { name: string; value: number }[];
        recentSchools: PlatformStats['recentSchools'];
      } }>('/analytics/platform');

      return {
        totalSchools: data.totals.totalSchools,
        activeSchools: data.totals.activeSchools,
        pendingSchools: data.totals.pendingSchools,
        suspendedSchools: data.totals.suspendedSchools,
        totalStudents: data.totals.totalStudents,
        totalTeachers: data.totals.totalTeachers,
        totalParents: data.totals.totalParents,
        totalCourses: data.totals.totalCourses,
        totalClasses: data.totals.totalClasses,
        schoolsByPlan: data.planDistribution,
        recentSchools: data.recentSchools,
      };
    },
  });
}

function useAttendanceAnalytics() {
  return useQuery({
    queryKey: ['attendance-analytics'],
    queryFn: async () => {
      const { data } = await api.get<{ attendance: { date: string; status: string }[] }>('/analytics/attendance');

      const byDate: Record<string, { present: number; absent: number; late: number }> = {};
      
      (data?.attendance || []).forEach(record => {
        if (!byDate[record.date]) {
          byDate[record.date] = { present: 0, absent: 0, late: 0 };
        }
        if (record.status === 'present') byDate[record.date].present++;
        else if (record.status === 'absent') byDate[record.date].absent++;
        else if (record.status === 'late') byDate[record.date].late++;
      });

      const chartData = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, stats]) => ({
          date: format(new Date(date), 'MMM dd'),
          present: stats.present,
          absent: stats.absent,
          late: stats.late,
        }));

      return chartData;
    },
  });
}

function useGradeAnalytics() {
  return useQuery({
    queryKey: ['grade-analytics'],
    queryFn: async () => {
      const { data } = await api.get<{ grades: { score: number; max_score: number; grade_type: string }[] }>('/analytics/grades');

      const distribution = { excellent: 0, good: 0, average: 0, poor: 0 };
      
      (data?.grades || []).forEach(grade => {
        const percentage = (grade.score / grade.max_score) * 100;
        if (percentage >= 90) distribution.excellent++;
        else if (percentage >= 70) distribution.good++;
        else if (percentage >= 50) distribution.average++;
        else distribution.poor++;
      });

      return [
        { name: 'Excellent (90%+)', value: distribution.excellent },
        { name: 'Good (70-89%)', value: distribution.good },
        { name: 'Average (50-69%)', value: distribution.average },
        { name: 'Poor (<50%)', value: distribution.poor },
      ];
    },
  });
}

export default function AnalyticsPage() {
  const { data: stats, isLoading: statsLoading } = usePlatformAnalytics();
  const { data: attendanceData, isLoading: attendanceLoading } = useAttendanceAnalytics();
  const { data: gradeData, isLoading: gradeLoading } = useGradeAnalytics();

  const isLoading = statsLoading;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const schoolStatusData = [
    { name: 'Active', value: stats?.activeSchools || 0 },
    { name: 'Pending', value: stats?.pendingSchools || 0 },
    { name: 'Suspended', value: stats?.suspendedSchools || 0 },
  ].filter(d => d.value > 0);

  return (
    <DashboardLayout>
      <PageHeader
        title="Platform Analytics"
        description="Comprehensive insights across all schools"
        breadcrumbs={[{ label: 'Analytics' }]}
      />

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalSchools || 0}</p>
                <p className="text-sm text-muted-foreground">Total Schools</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <GraduationCap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalStudents || 0}</p>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalTeachers || 0}</p>
                <p className="text-sm text-muted-foreground">Total Teachers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalCourses || 0}</p>
                <p className="text-sm text-muted-foreground">Total Courses</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different analytics views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* School Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">School Status Distribution</CardTitle>
                <CardDescription>Active, pending, and suspended schools</CardDescription>
              </CardHeader>
              <CardContent>
                {schoolStatusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={schoolStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {schoolStatusData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No school data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schools by Plan */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Schools by Subscription Plan</CardTitle>
                <CardDescription>Distribution across plans</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.schoolsByPlan && stats.schoolsByPlan.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stats.schoolsByPlan}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    No plan data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Additional Stats Row */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                    <Users className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalParents || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Parents</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
                    <School className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalClasses || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Classes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <UserCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.activeSchools || 0}</p>
                    <p className="text-sm text-muted-foreground">Active Schools</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Schools */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Schools</CardTitle>
              <CardDescription>Latest schools added to the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.recentSchools && stats.recentSchools.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentSchools.map((school) => (
                    <div key={school.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{school.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Added {format(new Date(school.createdAt), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        school.status === 'active' 
                          ? 'bg-green-500/10 text-green-700' 
                          : school.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-700'
                          : 'bg-red-500/10 text-red-700'
                      }`}>
                        {school.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">No schools yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance Trends (Last 7 Days)</CardTitle>
              <CardDescription>Platform-wide attendance across all schools</CardDescription>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : attendanceData && attendanceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="present" name="Present" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" name="Late" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" name="Absent" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <ClipboardCheck className="h-12 w-12 mb-2 opacity-50" />
                  <p>No attendance data for the last 7 days</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grade Distribution</CardTitle>
              <CardDescription>Performance distribution across all students</CardDescription>
            </CardHeader>
            <CardContent>
              {gradeLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : gradeData && gradeData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={gradeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => percent > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {gradeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mb-2 opacity-50" />
                  <p>No grade data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
