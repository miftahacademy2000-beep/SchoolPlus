import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
  Mail,
  Phone,
  GraduationCap,
  Hash,
  Bell,
  Settings,
  HelpCircle,
  FileText,
  CreditCard,
} from 'lucide-react';
import {
  useStudentProfile,
  useStudentClasses,
  useStudentCourses,
  useStudentGrades,
  useStudentExams,
  useStudentAttendance,
  useStudentTimetable,
  useStudentInvoices,
} from '@/hooks/useStudentData';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { HoverGradientNavBar, type HoverGradientMenuItem } from '@/components/ui/hover-gradient-nav-bar';
import { useIsMobile } from '@/hooks/use-mobile';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Student-specific navigation items
const studentNavItems: HoverGradientMenuItem[] = [
  { icon: User, label: "Profile", href: "#profile", gradient: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.06) 50%, rgba(29,78,216,0) 100%)", iconColor: "group-hover:text-blue-500 dark:group-hover:text-blue-400" },
  { icon: BookOpen, label: "Courses", href: "#courses", gradient: "radial-gradient(circle, rgba(147,51,234,0.15) 0%, rgba(126,34,206,0.06) 50%, rgba(88,28,135,0) 100%)", iconColor: "group-hover:text-purple-500 dark:group-hover:text-purple-400" },
  { icon: Calendar, label: "Schedule", href: "#schedule", gradient: "radial-gradient(circle, rgba(249,115,22,0.15) 0%, rgba(234,88,12,0.06) 50%, rgba(194,65,12,0) 100%)", iconColor: "group-hover:text-orange-500 dark:group-hover:text-orange-400" },
  { icon: ClipboardCheck, label: "Attendance", href: "#attendance", gradient: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.06) 50%, rgba(21,128,61,0) 100%)", iconColor: "group-hover:text-green-500 dark:group-hover:text-green-400" },
  { icon: TrendingUp, label: "Grades", href: "#grades", gradient: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.06) 50%, rgba(185,28,28,0) 100%)", iconColor: "group-hover:text-red-500 dark:group-hover:text-red-400" },
  { icon: FileText, label: "Exams", href: "#exams", gradient: "radial-gradient(circle, rgba(14,165,233,0.15) 0%, rgba(2,132,199,0.06) 50%, rgba(3,105,161,0) 100%)", iconColor: "group-hover:text-sky-500 dark:group-hover:text-sky-400" },
  { icon: CreditCard, label: "Payments", href: "#payments", gradient: "radial-gradient(circle, rgba(234,179,8,0.15) 0%, rgba(202,138,4,0.06) 50%, rgba(161,98,7,0) 100%)", iconColor: "group-hover:text-yellow-500 dark:group-hover:text-yellow-400" },
];

export default function StudentPortal() {
  const [activeTab, setActiveTab] = useState('profile');
  const isMobile = useIsMobile();
  
  const { data: studentProfile, isLoading: profileLoading } = useStudentProfile();
  const { data: classes, isLoading: classesLoading } = useStudentClasses();
  const { data: courses, isLoading: coursesLoading } = useStudentCourses();
  const { data: grades, isLoading: gradesLoading } = useStudentGrades();
  const { data: exams, isLoading: examsLoading } = useStudentExams();
  const { data: attendance, isLoading: attendanceLoading } = useStudentAttendance();
  const { data: timetable, isLoading: timetableLoading } = useStudentTimetable();
  const { data: invoices, isLoading: invoicesLoading } = useStudentInvoices();

  const isLoading = profileLoading;

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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!studentProfile) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <GraduationCap className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Student Profile Not Found</h2>
          <p className="text-sm text-muted-foreground">
            You don't have a student profile associated with your account.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handleNavClick = (item: HoverGradientMenuItem) => {
    const tab = item.href.replace('#', '');
    setActiveTab(tab);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="My Portal"
        description="View your academic information"
        breadcrumbs={[{ label: 'Student Portal' }]}
      />

      {/* Hover Gradient Navigation - Hidden on mobile (uses footer nav instead) */}
      <div className="hidden md:block">
        <HoverGradientNavBar items={studentNavItems} onItemClick={handleNavClick} />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-4 mb-4 md:mb-6">
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                <BookOpen className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{classes?.length || 0}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-green-500/10 shrink-0">
                <ClipboardCheck className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{attendancePercentage}%</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Attendance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-purple-500/10 shrink-0">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{gradeStats.average}%</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Avg Grade</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-orange-500/10 shrink-0">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{timetable?.length || 0}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Schedule</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={studentProfile.profile?.avatar_url || ''} />
                    <AvatarFallback className="text-lg">
                      {studentProfile.profile?.full_name?.charAt(0) || 'S'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">
                      {studentProfile.profile?.full_name || 'Student'}
                    </h3>
                    <p className="text-muted-foreground">Student</p>
                  </div>
                </div>
                
                <div className="grid gap-4">
                  {studentProfile.profile?.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{studentProfile.profile.email}</span>
                    </div>
                  )}
                  {studentProfile.profile?.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{studentProfile.profile.phone}</span>
                    </div>
                  )}
                  {studentProfile.enrollment_number && (
                    <div className="flex items-center gap-3">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">ID: {studentProfile.enrollment_number}</span>
                    </div>
                  )}
                  {studentProfile.grade && (
                    <div className="flex items-center gap-3">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Grade: {studentProfile.grade}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>School Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  {studentProfile.school?.logo_url ? (
                    <img 
                      src={studentProfile.school.logo_url} 
                      alt="School logo" 
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                      <School className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">{studentProfile.school?.name || 'School'}</h3>
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Courses Tab */}
        <TabsContent value="courses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Courses</CardTitle>
              <CardDescription>Courses scheduled for your enrolled classes</CardDescription>
            </CardHeader>
            <CardContent>
              {coursesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : courses?.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {courses.map((course) => (
                    <Card key={course.id} className="border">
                      <CardContent className="p-4">
                        <h4 className="font-semibold">{course.name}</h4>
                        <p className="text-sm text-muted-foreground">{course.code}</p>
                        {course.teacher?.profile?.full_name && (
                          <p className="mt-2 text-sm">Teacher: {course.teacher.profile.full_name}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No courses scheduled</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Classes</CardTitle>
              <CardDescription>Classes you are currently enrolled in</CardDescription>
            </CardHeader>
            <CardContent>
              {classesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : classes?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No enrolled courses</p>
              ) : (
                <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {classes?.map((enrollment) => (
                    <Card key={enrollment.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold">{enrollment.class?.name}</h4>
                            {enrollment.class?.section && (
                              <p className="text-sm text-muted-foreground">Section {enrollment.class.section}</p>
                            )}
                          </div>
                          {enrollment.class?.grade && (
                            <Badge variant="outline">Grade {enrollment.class.grade}</Badge>
                          )}
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
              <CardDescription>Your class timetable</CardDescription>
            </CardHeader>
            <CardContent>
              {timetableLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : timetable?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No schedule available</p>
              ) : (
                <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-5 md:gap-4">
                  {[1, 2, 3, 4, 5].map((dayIndex) => (
                    <div key={dayIndex} className="border-b pb-4 md:border-b-0 md:pb-0 last:border-b-0">
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <span className="md:hidden text-muted-foreground">📅</span>
                        {DAYS_OF_WEEK[dayIndex]}
                      </h4>
                      <div className="space-y-2">
                        {timetableByDay[dayIndex]?.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-3 md:py-4 border rounded-lg bg-muted/30">
                            No classes
                          </p>
                        ) : (
                          timetableByDay[dayIndex]
                            ?.sort((a, b) => a.start_time.localeCompare(b.start_time))
                            .map((slot) => (
                              <div
                                key={slot.id}
                                className={cn(
                                  "p-2.5 md:p-3 rounded-lg border text-sm",
                                  getSlotColor(slot.course?.id || null)
                                )}
                              >
                                <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                </div>
                                <p className="font-medium text-sm">
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
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4">
            <Card>
              <CardContent className="p-3 md:p-4">
                <p className="text-xl md:text-2xl font-bold text-green-600">{attendanceStats.present}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Present</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:p-4">
                <p className="text-xl md:text-2xl font-bold text-red-600">{attendanceStats.absent}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Absent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:p-4">
                <p className="text-xl md:text-2xl font-bold text-yellow-600">{attendanceStats.late}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Late</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs md:text-sm text-muted-foreground">Overall</p>
                  <p className="text-xs md:text-sm font-medium">{attendancePercentage}%</p>
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
                <ScrollArea className="h-[300px] md:h-[400px]">
                  <div className="space-y-2">
                    {attendance?.map((record) => (
                      <div
                        key={record.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 md:p-3 rounded-lg border gap-2"
                      >
                        <div className="flex items-center gap-2 md:gap-3 min-w-0">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm md:text-base truncate">
                              {format(new Date(record.date), 'EEE, MMM d, yyyy')}
                            </p>
                            <p className="text-xs md:text-sm text-muted-foreground truncate">
                              {record.class?.name || 'Unknown Class'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
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
              <CardDescription>Average: {gradeStats.average}% across {gradeStats.total} assessments</CardDescription>
            </CardHeader>
            <CardContent>
              {gradesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : grades?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No grades available</p>
              ) : (
                <ScrollArea className="h-[350px] md:h-[500px]">
                  <div className="space-y-2 md:space-y-3">
                    {grades?.map((grade) => {
                      const percentage = Math.round((grade.score / grade.max_score) * 100);
                      return (
                        <div
                          key={grade.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 rounded-lg border gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1">
                              <h4 className="font-medium text-sm md:text-base truncate">{grade.title}</h4>
                              <Badge variant="outline" className="text-[10px] md:text-xs shrink-0">
                                {grade.grade_type}
                              </Badge>
                            </div>
                            <p className="text-xs md:text-sm text-muted-foreground truncate">
                              {grade.course?.name} ({grade.course?.code})
                            </p>
                            <p className="text-[10px] md:text-xs text-muted-foreground">
                              {format(new Date(grade.graded_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="text-left sm:text-right shrink-0">
                            <p className={cn('text-lg md:text-xl font-bold', getGradeColor(percentage))}>
                              {grade.score}/{grade.max_score}
                            </p>
                            <p className="text-xs md:text-sm text-muted-foreground">{percentage}%</p>
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

        <TabsContent value="exams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exams and Report Card</CardTitle>
              <CardDescription>Your recorded exam results</CardDescription>
            </CardHeader>
            <CardContent>
              {examsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : exams?.length ? (
                <div className="space-y-3">
                  {exams.map((exam) => (
                    <div key={exam.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{exam.exam_types?.name || 'Exam'}</p>
                        <p className="text-sm text-muted-foreground">
                          {exam.subjects?.name || exam.classes.name}
                          {exam.terms?.name ? ` · ${exam.terms.name}` : ''}
                        </p>
                        {exam.remarks && <p className="mt-1 text-sm">{exam.remarks}</p>}
                      </div>
                      <p className="shrink-0 font-semibold">{exam.score}/{exam.max_score}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No exam results available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoices and Payments</CardTitle>
              <CardDescription>Your billing records and recorded payments</CardDescription>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : invoices?.invoices.length ? (
                <div className="space-y-4">
                  {invoices.invoices.map((invoice) => (
                    <div key={invoice.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{invoice.title}</p>
                          <p className="text-sm text-muted-foreground">{invoice.invoiceNumber}</p>
                        </div>
                        <Badge variant={invoice.status === 'paid' ? 'secondary' : 'outline'}>{invoice.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm">
                        Amount: {invoice.currency} {Number(invoice.amount).toFixed(2)}
                        {' · '}Paid: {invoice.currency} {Number(invoice.amountPaid).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
                      </p>
                      {invoice.paymentHistory.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">Payments</p>
                          {invoice.paymentHistory.map((payment) => (
                            <p key={payment.id} className="text-sm">
                              {invoice.currency} {Number(payment.amount).toFixed(2)}
                              {' · '}{format(new Date(payment.createdAt), 'MMM d, yyyy')}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No invoices available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add padding at bottom for mobile footer nav */}
      {isMobile && <div className="h-20" />}

      {/* Mobile Sticky Footer Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border shadow-lg safe-area-inset-bottom">
          <div className="flex items-center justify-around overflow-x-auto py-2 px-1">
            {studentNavItems.map((item) => {
              const isActive = activeTab === item.href.replace('#', '');
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[56px]",
                    isActive 
                      ? "text-primary bg-primary/10" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive && "scale-110")} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </DashboardLayout>
  );
}
