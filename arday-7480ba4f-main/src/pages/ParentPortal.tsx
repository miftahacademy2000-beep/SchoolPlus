import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  BookOpen,
  Calendar,
  ClipboardCheck,
  TrendingUp,
  Clock,
  MapPin,
  Loader2,
  School,
  GraduationCap,
  Hash,
  Users,
  Receipt,
  CreditCard,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  useParentChildren,
  useChildClasses,
  useChildGrades,
  useChildAttendance,
  useChildTimetable,
  useChildInvoices,
} from '@/hooks/useParentData';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ParentPortal() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const { data: children, isLoading: childrenLoading } = useParentChildren();
  
  // Auto-select first child
  const currentChildId = selectedChildId || children?.[0]?.id || null;
  const currentChild = children?.find(c => c.id === currentChildId);

  const { data: classes, isLoading: classesLoading } = useChildClasses(currentChildId);
  const { data: grades, isLoading: gradesLoading } = useChildGrades(currentChildId);
  const { data: attendance, isLoading: attendanceLoading } = useChildAttendance(currentChildId);
  const { data: timetable, isLoading: timetableLoading } = useChildTimetable(currentChildId);
  const { data: invoices, isLoading: invoicesLoading } = useChildInvoices(currentChildId);

  // Calculate attendance stats
  const attendanceStats = {
    total: attendance?.length || 0,
    present: attendance?.filter(a => a.status === 'present').length || 0,
    absent: attendance?.filter(a => a.status === 'absent').length || 0,
    late: attendance?.filter(a => a.status === 'late').length || 0,
  };
  const attendancePercentage = attendanceStats.total > 0 
    ? Math.round((attendanceStats.present / attendanceStats.total) * 100) 
    : 0;

  // Calculate grade stats
  const gradeStats = {
    total: grades?.length || 0,
    average: grades?.length
      ? Math.round(grades.reduce((acc, g) => acc + (g.score / g.max_score) * 100, 0) / grades.length)
      : 0,
  };

  // Calculate invoice stats
  const invoiceStats = {
    total: invoices?.length || 0,
    pending: invoices?.filter(i => i.status === 'pending').length || 0,
    overdue: invoices?.filter(i => i.status === 'overdue').length || 0,
    paid: invoices?.filter(i => i.status === 'paid').length || 0,
    totalAmount: invoices?.reduce((acc, i) => acc + Number(i.amount), 0) || 0,
    pendingAmount: invoices?.filter(i => i.status === 'pending' || i.status === 'overdue')
      .reduce((acc, i) => acc + Number(i.amount), 0) || 0,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-700 border-green-500/30">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30">Pending</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500/10 text-red-700 border-red-500/30">Overdue</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500/10 text-gray-700 border-gray-500/30">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Group timetable by day

  // Group timetable by day
  const timetableByDay = DAYS_OF_WEEK.reduce((acc, _, index) => {
    acc[index] = (timetable || []).filter(slot => slot.day_of_week === index);
    return acc;
  }, {} as Record<number, typeof timetable>);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getSlotColor = (courseId: string | null) => {
    if (!courseId) return 'bg-muted border-muted-foreground/20';
    const colors = [
      'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
      'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300',
      'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300',
      'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300',
      'bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-300',
    ];
    const index = courseId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-500/10 text-green-700 border-green-500/30">Present</Badge>;
      case 'absent':
        return <Badge className="bg-red-500/10 text-red-700 border-red-500/30">Absent</Badge>;
      case 'late':
        return <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30">Late</Badge>;
      case 'excused':
        return <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/30">Excused</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-blue-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (childrenLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!children || children.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No Children Linked</h2>
          <p className="text-sm text-muted-foreground">
            You don't have any children linked to your account yet.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Parent Portal"
        description="View your children's academic information"
        breadcrumbs={[{ label: 'Parent Portal' }]}
      />

      {/* Child Selector */}
      {children.length > 1 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Select Child:</label>
              <Select 
                value={currentChildId || "none"} 
                onValueChange={(val) => setSelectedChildId(val === "none" ? null : val)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.profile?.full_name || 'Unknown'}
                      {child.relationship && ` (${child.relationship})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{classes?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Classes Enrolled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <ClipboardCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{attendancePercentage}%</p>
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{gradeStats.average}%</p>
                <p className="text-sm text-muted-foreground">Average Grade</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <GraduationCap className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{gradeStats.total}</p>
                <p className="text-sm text-muted-foreground">Assessments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="classes" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Classes</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="grades" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Grades</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Invoices</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Child Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentChild && (
                  <>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={currentChild.profile?.avatar_url || ''} />
                        <AvatarFallback className="text-lg">
                          {currentChild.profile?.full_name?.charAt(0) || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-xl font-semibold">
                          {currentChild.profile?.full_name || 'Student'}
                        </h3>
                        <p className="text-muted-foreground capitalize">
                          {currentChild.relationship || 'Child'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid gap-4">
                      {currentChild.enrollment_number && (
                        <div className="flex items-center gap-3">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">ID: {currentChild.enrollment_number}</span>
                        </div>
                      )}
                      {currentChild.grade && (
                        <div className="flex items-center gap-3">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Grade: {currentChild.grade}</span>
                        </div>
                      )}
                      {currentChild.date_of_birth && (
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            DOB: {format(new Date(currentChild.date_of_birth + 'T00:00:00'), 'dd/MM/yyyy')}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>School Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentChild && (
                  <>
                    <div className="flex items-center gap-4">
                      {currentChild.school?.logo_url ? (
                        <img 
                          src={currentChild.school.logo_url} 
                          alt="School logo" 
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                          <School className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold">{currentChild.school?.name || 'School'}</h3>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Enrolled Classes</h4>
                      {classesLoading ? (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      ) : classes?.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No classes enrolled</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {classes?.map((enrollment) => (
                            <Badge key={enrollment.id} variant="secondary">
                              {enrollment.class?.name}
                              {enrollment.class?.section && ` (${enrollment.class.section})`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* All Children Overview (if multiple) */}
          {children.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>All Children</CardTitle>
                <CardDescription>Quick overview of all your children</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {children.map((child) => (
                    <Card 
                      key={child.id} 
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/50",
                        child.id === currentChildId && "border-primary"
                      )}
                      onClick={() => setSelectedChildId(child.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={child.profile?.avatar_url || ''} />
                            <AvatarFallback>
                              {child.profile?.full_name?.charAt(0) || 'S'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{child.profile?.full_name || 'Student'}</p>
                            <p className="text-sm text-muted-foreground">
                              {child.grade && `Grade ${child.grade}`}
                              {child.relationship && ` • ${child.relationship}`}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Classes Tab */}
        <TabsContent value="classes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Classes</CardTitle>
              <CardDescription>Classes {currentChild?.profile?.full_name || 'your child'} is enrolled in</CardDescription>
            </CardHeader>
            <CardContent>
              {classesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : classes?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No classes enrolled</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {classes?.map((enrollment) => (
                    <Card key={enrollment.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold">{enrollment.class?.name}</h4>
                            {enrollment.class?.grade && (
                              <p className="text-sm text-muted-foreground">
                                Grade {enrollment.class.grade}
                                {enrollment.class.section && ` - Section ${enrollment.class.section}`}
                              </p>
                            )}
                          </div>
                        </div>
                        {enrollment.class?.teacher?.profile?.full_name && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Teacher:</span>{' '}
                            {enrollment.class.teacher.profile.full_name}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Enrolled: {format(new Date(enrollment.enrolled_at), 'MMM d, yyyy')}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>Class timetable for {currentChild?.profile?.full_name || 'your child'}</CardDescription>
            </CardHeader>
            <CardContent>
              {timetableLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : timetable?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No schedule available</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map((dayIndex) => (
                    <div key={dayIndex}>
                      <h4 className="font-medium text-sm mb-2">{DAYS_OF_WEEK[dayIndex]}</h4>
                      <div className="space-y-2">
                        {timetableByDay[dayIndex]?.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">
                            No classes
                          </p>
                        ) : (
                          timetableByDay[dayIndex]
                            ?.sort((a, b) => a.start_time.localeCompare(b.start_time))
                            .map((slot) => (
                              <div
                                key={slot.id}
                                className={cn(
                                  "p-3 rounded-lg border text-sm",
                                  getSlotColor(slot.course?.id || null)
                                )}
                              >
                                <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                </div>
                                <p className="font-medium">
                                  {slot.course?.name || 'Free Period'}
                                </p>
                                {slot.teacher?.profile?.full_name && (
                                  <p className="text-xs opacity-80">{slot.teacher.profile.full_name}</p>
                                )}
                                {slot.room && (
                                  <div className="flex items-center gap-1 text-xs opacity-80 mt-1">
                                    <MapPin className="h-3 w-3" />
                                    {slot.room}
                                  </div>
                                )}
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-green-600">{attendanceStats.present}</p>
                <p className="text-sm text-muted-foreground">Present</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-red-600">{attendanceStats.absent}</p>
                <p className="text-sm text-muted-foreground">Absent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-yellow-600">{attendanceStats.late}</p>
                <p className="text-sm text-muted-foreground">Late</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Overall</p>
                  <p className="text-sm font-medium">{attendancePercentage}%</p>
                </div>
                <Progress value={attendancePercentage} className="h-2" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Attendance Records</CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : attendance?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No attendance records</p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {attendance?.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">
                              {format(new Date(record.date), 'EEEE, MMM d, yyyy')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {record.class?.name || 'Unknown Class'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(record.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grades Tab */}
        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Grade Summary</CardTitle>
              <CardDescription>
                {currentChild?.profile?.full_name || 'Your child'}'s grades: 
                Average {gradeStats.average}% across {gradeStats.total} assessments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gradesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : grades?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No grades available</p>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {grades?.map((grade) => {
                      const percentage = Math.round((grade.score / grade.max_score) * 100);
                      return (
                        <div
                          key={grade.id}
                          className="flex items-center justify-between p-4 rounded-lg border"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{grade.title}</h4>
                              <Badge variant="outline" className="text-xs">
                                {grade.grade_type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {grade.course?.name} ({grade.course?.code})
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(grade.graded_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={cn('text-xl font-bold', getGradeColor(percentage))}>
                              {grade.score}/{grade.max_score}
                            </p>
                            <p className="text-sm text-muted-foreground">{percentage}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Receipt className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{invoiceStats.total}</p>
                    <p className="text-sm text-muted-foreground">Total Invoices</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{invoiceStats.pending}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{invoiceStats.overdue}</p>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{invoiceStats.paid}</p>
                    <p className="text-sm text-muted-foreground">Paid</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {invoiceStats.pendingAmount > 0 && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="font-medium">Outstanding Balance</p>
                      <p className="text-sm text-muted-foreground">
                        {invoiceStats.pending + invoiceStats.overdue} invoice(s) pending payment
                      </p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {formatCurrency(invoiceStats.pendingAmount)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
              <CardDescription>
                All invoices for {currentChild?.profile?.full_name || 'your child'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : invoices?.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No invoices found</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {invoices?.map((invoice) => (
                      <div
                        key={invoice.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border",
                          invoice.status === 'overdue' && "border-red-500/30 bg-red-500/5"
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{invoice.title}</h4>
                            {getInvoiceStatusBadge(invoice.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Invoice #{invoice.invoice_number}
                          </p>
                          {invoice.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {invoice.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
                            {invoice.paid_date && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                Paid: {format(new Date(invoice.paid_date), 'MMM d, yyyy')}
                              </span>
                            )}
                            {invoice.payment_method && (
                              <span className="flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                {invoice.payment_method}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            'text-xl font-bold',
                            invoice.status === 'paid' ? 'text-green-600' :
                            invoice.status === 'overdue' ? 'text-red-600' :
                            'text-foreground'
                          )}>
                            {formatCurrency(Number(invoice.amount))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
