import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  User,
  BookOpen,
  Calendar,
  ClipboardCheck,
  TrendingUp,
  Clock,
  Loader2,
  School,
  Mail,
  Phone,
  Hash,
  Users,
  GraduationCap,
  BarChart3,
  Edit,
  Plus,
  Save,
  Briefcase,
} from 'lucide-react';
import {
  useTeacherProfile,
  useTeacherClasses,
  useTeacherCourses,
  useTeacherGrades,
  useTeacherTimetable,
  useClassPerformance,
  useClassStudents,
} from '@/hooks/useTeacherData';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CHART_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];

export default function TeacherPortal() {
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ phone: '', department: '' });
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: teacherProfile, isLoading: profileLoading } = useTeacherProfile();
  const { data: classes, isLoading: classesLoading } = useTeacherClasses();
  const { data: courses, isLoading: coursesLoading } = useTeacherCourses();
  const { data: grades, isLoading: gradesLoading } = useTeacherGrades();
  const { data: timetable, isLoading: timetableLoading } = useTeacherTimetable();
  const { data: performance, isLoading: performanceLoading } = useClassPerformance();
  const { data: classStudents, isLoading: studentsLoading } = useClassStudents(selectedClassId);

  const isLoading = profileLoading;

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

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-blue-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleEditProfile = () => {
    setEditForm({
      phone: teacherProfile?.profile?.phone || '',
      department: teacherProfile?.department || '',
    });
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!user?.id || !teacherProfile) return;

    try {
      // Update profile phone
      await api.put('/profiles/me', { phone: editForm.phone });

      // Update teacher department
      await api.put(`/teachers/${teacherProfile.id}`, { department: editForm.department });

      queryClient.invalidateQueries({ queryKey: ['teacher-profile'] });
      toast({ title: 'Profile updated successfully' });
      setIsEditing(false);
    } catch (error) {
      toast({ title: 'Failed to update profile', variant: 'destructive' });
    }
  };

  // Calculate stats
  const totalStudents = classes?.reduce((acc, cls) => acc + cls.student_count, 0) || 0;
  const avgPerformance = performance?.length
    ? Math.round(performance.reduce((acc, p) => acc + p.averageGrade, 0) / performance.length)
    : 0;
  const avgAttendance = performance?.length
    ? Math.round(performance.reduce((acc, p) => acc + p.attendanceRate, 0) / performance.length)
    : 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!teacherProfile) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Briefcase className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Teacher Profile Not Found</h2>
          <p className="text-sm text-muted-foreground">
            You don't have a teacher profile associated with your account.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Teacher Portal"
        description="Manage your classes, courses, and students"
        breadcrumbs={[{ label: 'Teacher Portal' }]}
      />

      {/* Quick Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-4 md:mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <School className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{classes?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Assigned Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total Students</p>
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
                <p className="text-2xl font-bold">{avgPerformance}%</p>
                <p className="text-sm text-muted-foreground">Avg. Grade</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <ClipboardCheck className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgAttendance}%</p>
                <p className="text-sm text-muted-foreground">Avg. Attendance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="classes" className="gap-2">
            <School className="h-4 w-4" />
            <span className="hidden sm:inline">Classes</span>
          </TabsTrigger>
          <TabsTrigger value="courses" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Courses</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule</span>
          </TabsTrigger>
          <TabsTrigger value="grades" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Grades</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Personal Information</CardTitle>
                {!isEditing && (
                  <Button variant="outline" size="sm" onClick={handleEditProfile}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={teacherProfile.profile?.avatar_url || ''} />
                    <AvatarFallback className="text-lg">
                      {teacherProfile.profile?.full_name?.charAt(0) || 'T'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">
                      {teacherProfile.profile?.full_name || 'Teacher'}
                    </h3>
                    <p className="text-muted-foreground">Teacher</p>
                  </div>
                </div>
                
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        value={editForm.department}
                        onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                        placeholder="Enter department"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveProfile}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {teacherProfile.profile?.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{teacherProfile.profile.email}</span>
                      </div>
                    )}
                    {teacherProfile.profile?.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{teacherProfile.profile.phone}</span>
                      </div>
                    )}
                    {teacherProfile.employee_id && (
                      <div className="flex items-center gap-3">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">ID: {teacherProfile.employee_id}</span>
                      </div>
                    )}
                    {teacherProfile.department && (
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Dept: {teacherProfile.department}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>School Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  {teacherProfile.school?.logo_url ? (
                    <img 
                      src={teacherProfile.school.logo_url} 
                      alt="School logo" 
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                      <School className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold">{teacherProfile.school?.name || 'School'}</h3>
                  </div>
                </div>

                {teacherProfile.subjects && teacherProfile.subjects.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Subjects</h4>
                    <div className="flex flex-wrap gap-2">
                      {teacherProfile.subjects.map((subject, index) => (
                        <Badge key={index} variant="secondary">
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium mb-2">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('classes')}>
                      <School className="h-4 w-4 mr-2" />
                      View Classes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('grades')}>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Enter Grades
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Classes Tab */}
        <TabsContent value="classes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Assigned Classes</CardTitle>
                <CardDescription>Classes you are responsible for</CardDescription>
              </CardHeader>
              <CardContent>
                {classesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : classes?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No classes assigned</p>
                ) : (
                  <div className="space-y-3">
                    {classes?.map((cls) => (
                      <Card
                        key={cls.id}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/50",
                          selectedClassId === cls.id && "border-primary"
                        )}
                        onClick={() => setSelectedClassId(cls.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold">{cls.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {cls.grade && `Grade ${cls.grade}`}
                                {cls.section && ` - Section ${cls.section}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant="secondary">
                                {cls.student_count} / {cls.capacity || '∞'}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">Students</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedClassId ? 'Class Students' : 'Select a Class'}
                </CardTitle>
                <CardDescription>
                  {selectedClassId 
                    ? `Students enrolled in ${classes?.find(c => c.id === selectedClassId)?.name}`
                    : 'Click on a class to view students'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedClassId ? (
                  <p className="text-center text-muted-foreground py-8">
                    Select a class to view students
                  </p>
                ) : studentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : classStudents?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No students enrolled
                  </p>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {classStudents?.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={student.profile?.avatar_url || ''} />
                            <AvatarFallback className="text-xs">
                              {student.profile?.full_name?.charAt(0) || 'S'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {student.profile?.full_name || 'Unknown'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {student.enrollment_number || 'No ID'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Courses Tab */}
        <TabsContent value="courses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Courses</CardTitle>
              <CardDescription>Courses you are teaching</CardDescription>
            </CardHeader>
            <CardContent>
              {coursesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : courses?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No courses assigned</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {courses?.map((course) => (
                    <Card key={course.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold">{course.name}</h4>
                            <p className="text-sm text-muted-foreground">{course.code}</p>
                          </div>
                          {course.credits && (
                            <Badge variant="outline">{course.credits} credits</Badge>
                          )}
                        </div>
                        {course.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {course.description}
                          </p>
                        )}
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
              <CardDescription>Your teaching timetable</CardDescription>
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
                                <p className="text-xs opacity-80">
                                  {slot.class?.name}
                                  {slot.class?.section && ` (${slot.class.section})`}
                                </p>
                                {slot.room && (
                                  <p className="text-xs opacity-70 mt-1">Room: {slot.room}</p>
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

        {/* Grades Tab */}
        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Grades</CardTitle>
              <CardDescription>Grades you have entered</CardDescription>
            </CardHeader>
            <CardContent>
              {gradesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : grades?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No grades entered yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grades?.slice(0, 20).map((grade) => {
                      const percentage = Math.round((grade.score / grade.max_score) * 100);
                      return (
                        <TableRow key={grade.id}>
                          <TableCell className="font-medium">
                            {grade.student?.profile?.full_name || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{grade.course?.code}</Badge>
                          </TableCell>
                          <TableCell>{grade.title}</TableCell>
                          <TableCell className="capitalize">{grade.grade_type}</TableCell>
                          <TableCell>
                            <span className={getGradeColor(percentage)}>
                              {grade.score}/{grade.max_score} ({percentage}%)
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(grade.graded_at), 'MMM d, yyyy')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Class Performance Overview</CardTitle>
                <CardDescription>Average grades by class</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : performance?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="className" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="averageGrade" fill="#3b82f6" name="Avg. Grade %" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attendance Rates</CardTitle>
                <CardDescription>Attendance by class</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : performance?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={performance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="className" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="attendanceRate" fill="#10b981" name="Attendance %" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Class Summary</CardTitle>
              <CardDescription>Detailed performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : performance?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Students</TableHead>
                      <TableHead>Avg. Grade</TableHead>
                      <TableHead>Attendance Rate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performance?.map((perf) => (
                      <TableRow key={perf.classId}>
                        <TableCell className="font-medium">{perf.className}</TableCell>
                        <TableCell>{perf.studentCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={perf.averageGrade} className="w-16 h-2" />
                            <span className={getGradeColor(perf.averageGrade)}>
                              {perf.averageGrade}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={perf.attendanceRate} className="w-16 h-2" />
                            <span>{perf.attendanceRate}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {perf.averageGrade >= 70 && perf.attendanceRate >= 80 ? (
                            <Badge className="bg-green-500/10 text-green-700 border-green-500/30">
                              Good
                            </Badge>
                          ) : perf.averageGrade >= 50 || perf.attendanceRate >= 60 ? (
                            <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                              Needs Attention
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-700 border-red-500/30">
                              At Risk
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
