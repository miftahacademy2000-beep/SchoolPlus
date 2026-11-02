import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useClasses } from '@/hooks/useClasses';
import { useTeachers } from '@/hooks/useTeachers';
import { useCourses } from '@/hooks/useGrades';
import { 
  useTimetable, 
  useCreateTimetableSlot, 
  useDeleteTimetableSlot,
  DAYS_OF_WEEK,
  type TimetableSlot 
} from '@/hooks/useTimetable';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Calendar, 
  Loader2, 
  Plus, 
  Clock,
  MapPin,
  Trash2,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TimetablePage() {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<TimetableSlot | null>(null);
  
  // Form state
  const [dayOfWeek, setDayOfWeek] = useState<string>('1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [room, setRoom] = useState('');
  
  const { primaryRole, isSuperAdmin } = useAuth();
  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data: timetable, isLoading: timetableLoading } = useTimetable(selectedClassId || null);
  const { data: courses } = useCourses();
  const { data: teachers } = useTeachers();
  const createSlot = useCreateTimetableSlot();
  const deleteSlot = useDeleteTimetableSlot();

  // Only super_admin, school_admin, and teacher can manage timetable
  const canManageTimetable = isSuperAdmin || primaryRole === 'school_admin' || primaryRole === 'teacher';

  // Group timetable by day
  const timetableByDay = DAYS_OF_WEEK.reduce((acc, day, index) => {
    acc[index] = (timetable || []).filter(slot => slot.day_of_week === index);
    return acc;
  }, {} as Record<number, TimetableSlot[]>);

  const handleAddSlot = async () => {
    if (!selectedClassId) return;
    
    await createSlot.mutateAsync({
      class_id: selectedClassId,
      day_of_week: parseInt(dayOfWeek),
      start_time: startTime,
      end_time: endTime,
      course_id: selectedCourse || undefined,
      teacher_id: selectedTeacher || undefined,
      room: room.trim() || undefined,
    });
    
    resetForm();
    setAddDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!slotToDelete) return;
    await deleteSlot.mutateAsync(slotToDelete.id);
    setSlotToDelete(null);
  };

  const resetForm = () => {
    setDayOfWeek('1');
    setStartTime('09:00');
    setEndTime('10:00');
    setSelectedCourse('');
    setSelectedTeacher('');
    setRoom('');
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Generate color based on course ID for consistency
  const getSlotColor = (courseId: string | null) => {
    if (!courseId) return 'bg-muted border-muted-foreground/20';
    const colors = [
      'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
      'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300',
      'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300',
      'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300',
      'bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-300',
      'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300',
    ];
    const index = courseId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Timetable"
        description={canManageTimetable ? "Manage class schedules and timetables" : "View class schedules"}
        breadcrumbs={[{ label: 'Timetable' }]}
        actions={
          canManageTimetable && selectedClassId ? (
            <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Slot
            </Button>
          ) : undefined
        }
      />

      {/* Class Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Class</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Select a class to view timetable" />
            </SelectTrigger>
            <SelectContent>
              {classesLoading ? (
                <SelectItem value="loading" disabled>Loading classes...</SelectItem>
              ) : (
                classes?.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} {cls.grade && `- ${cls.grade}`} {cls.section && `(${cls.section})`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Timetable Grid */}
      {!selectedClassId ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Calendar className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Select a class</h2>
          <p className="text-sm text-muted-foreground">
            Choose a class to view {canManageTimetable ? 'and manage ' : ''}its timetable
          </p>
        </div>
      ) : timetableLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((dayIndex) => (
            <Card key={dayIndex}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  {DAYS_OF_WEEK[dayIndex]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {timetableByDay[dayIndex]?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No classes scheduled
                  </p>
                ) : (
                  timetableByDay[dayIndex]
                    ?.sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((slot) => (
                      <div
                        key={slot.id}
                        className={cn(
                          "p-3 rounded-lg border relative group",
                          getSlotColor(slot.course_id)
                        )}
                      >
                        {canManageTimetable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() => setSlotToDelete(slot)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                        
                        <div className="flex items-center gap-1.5 text-xs font-medium mb-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        </div>
                        
                        <p className="font-medium text-sm">
                          {slot.course?.name || 'Free Period'}
                        </p>
                        
                        {slot.teacher?.profile?.full_name && (
                          <div className="flex items-center gap-1 text-xs mt-1 opacity-80">
                            <User className="h-3 w-3" />
                            {slot.teacher.profile.full_name}
                          </div>
                        )}
                        
                        {slot.room && (
                          <div className="flex items-center gap-1 text-xs mt-0.5 opacity-80">
                            <MapPin className="h-3 w-3" />
                            {slot.room}
                          </div>
                        )}
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Slot Dialog - only render if user can manage */}
      {canManageTimetable && (
        <>
          <Dialog open={addDialogOpen} onOpenChange={(open) => {
            setAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Timetable Slot</DialogTitle>
                <DialogDescription>Add a new slot to the class timetable</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Day</Label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {DAYS_OF_WEEK[day]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Course (optional)</Label>
                  <Select value={selectedCourse || "none"} onValueChange={(val) => setSelectedCourse(val === "none" ? "" : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No course (Free period)</SelectItem>
                      {courses?.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name} ({course.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Teacher (optional)</Label>
                  <Select value={selectedTeacher || "none"} onValueChange={(val) => setSelectedTeacher(val === "none" ? "" : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No teacher assigned</SelectItem>
                      {teachers?.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.profile?.full_name || 'Unknown Teacher'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Room (optional)</Label>
                  <Input
                    placeholder="e.g., Room 101"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddSlot} disabled={createSlot.isPending}>
                  {createSlot.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Slot
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation */}
          <AlertDialog open={!!slotToDelete} onOpenChange={() => setSlotToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Timetable Slot</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this slot? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </DashboardLayout>
  );
}
