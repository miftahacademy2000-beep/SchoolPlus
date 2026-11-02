import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Search, Users, UserCog, UserPlus, X, Settings, CheckSquare } from 'lucide-react';
import { useUpdateClass, type ClassWithTeacher } from '@/hooks/useClasses';
import { useClassEnrollment, useEnrollStudents, useUnenrollStudent } from '@/hooks/useClassEnrollment';
import { useClassTeacherEnrollment, useEnrollTeachers, useUnenrollTeacher } from '@/hooks/useClassTeachers';
import { useToast } from '@/hooks/use-toast';

interface EditClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: ClassWithTeacher;
  onSaved?: (updated: ClassWithTeacher) => void;
}

export function EditClassModal({ open, onOpenChange, classData, onSaved }: EditClassModalProps) {
  // Details tab state
  const [name, setName] = useState(classData.name);
  const [grade, setGrade] = useState(classData.grade || '');
  const [section, setSection] = useState(classData.section || '');
  const [capacity, setCapacity] = useState(String(classData.capacity || 30));
  const [monthlyFee, setMonthlyFee] = useState(classData.monthly_fee != null ? String(classData.monthly_fee) : '');
  const [program, setProgram] = useState(classData.program || '');
  const [levelLabel, setLevelLabel] = useState(classData.level_label || '');

  // Teacher tab state
  const [teacherSearch, setTeacherSearch] = useState('');
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);

  // Students tab state
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [enrolledStudentSearch, setEnrolledStudentSearch] = useState('');

  const updateClass = useUpdateClass();
  const { toast } = useToast();
  const { enrolledTeachers, availableTeachers: allAvailableTeachers, isLoading: teachersLoading } = useClassTeacherEnrollment(classData.id);
  const enrollTeachers = useEnrollTeachers();
  const unenrollTeacher = useUnenrollTeacher();
  const { data: enrollmentData, isLoading: enrollmentLoading } = useClassEnrollment(classData.id);
  const enrollStudents = useEnrollStudents();
  const unenrollStudent = useUnenrollStudent();

  useEffect(() => {
    setName(classData.name);
    setGrade(classData.grade || '');
    setSection(classData.section || '');
    setCapacity(String(classData.capacity || 30));
    setProgram(classData.program || '');
    setLevelLabel(classData.level_label || '');
    setMonthlyFee(classData.monthly_fee != null ? String(classData.monthly_fee) : '');
    setTeacherSearch('');
    setSelectedTeachers([]);
    setStudentSearch('');
    setSelectedStudents([]);
    setEnrolledStudentSearch('');
  }, [classData]);

  const handleSaveDetails = async () => {
    if (!name.trim()) return;

    const trimmedFee = monthlyFee.trim();
    let fee: number | null = null;
    if (trimmedFee !== '') {
      const parsed = parseFloat(trimmedFee);
      if (isNaN(parsed) || parsed < 0) {
        toast({
          title: 'Invalid monthly fee',
          description: 'Please enter a valid non-negative decimal amount (e.g. 5.75).',
          variant: 'destructive',
        });
        return;
      }
      fee = parsed > 0 ? parsed : null;
    }

    try {
      const updated = await updateClass.mutateAsync({
        id: classData.id,
        school_id: classData.school_id,
        name,
        grade: grade || undefined,
        section: section || undefined,
        capacity: parseInt(capacity) || 30,
        monthly_fee: fee,
        program: program || undefined,
        level_label: levelLabel || undefined,
      });
      // Sync local form state with the persisted values.
      if (updated) {
        setName(updated.name ?? name);
        setGrade(updated.grade || '');
        setSection(updated.section || '');
        setCapacity(String(updated.capacity || 30));
        setMonthlyFee(updated.monthly_fee != null ? String(updated.monthly_fee) : '');
        setProgram(updated.program || '');
        setLevelLabel(updated.level_label || '');
        onSaved?.(updated);
      }
      // Invalidation of class/fee queries is handled by useUpdateClass.onSuccess.
    } catch {
      // Error toast is shown by the mutation hook; keep dialog open and values.
    }
  };

  // Teacher enrollment
  const availableTeachers = useMemo(() => {
    if (!allAvailableTeachers) return [];
    if (!teacherSearch) return allAvailableTeachers;
    return allAvailableTeachers.filter(t =>
      t.profile?.full_name?.toLowerCase().includes(teacherSearch.toLowerCase()) ||
      t.employee_id?.toLowerCase().includes(teacherSearch.toLowerCase()) ||
      t.department?.toLowerCase().includes(teacherSearch.toLowerCase())
    );
  }, [allAvailableTeachers, teacherSearch]);

  const toggleTeacher = (id: string) => {
    setSelectedTeachers(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllTeachers = () => {
    if (selectedTeachers.length === availableTeachers.length) {
      setSelectedTeachers([]);
    } else {
      setSelectedTeachers(availableTeachers.map(t => t.id));
    }
  };

  const handleEnrollTeachers = async () => {
    if (selectedTeachers.length === 0) return;
    await enrollTeachers.mutateAsync({
      classId: classData.id,
      teacherIds: selectedTeachers,
    });
    setSelectedTeachers([]);
  };

  const handleUnenrollTeacher = async (teacherId: string) => {
    await unenrollTeacher.mutateAsync({
      classId: classData.id,
      teacherId,
    });
  };

  // Student enrollment
  const filteredEnrolledStudents = useMemo(() => {
    if (!enrollmentData?.enrolledStudents) return [];
    if (!enrolledStudentSearch) return enrollmentData.enrolledStudents;
    return enrollmentData.enrolledStudents.filter(s =>
      s.profile?.full_name?.toLowerCase().includes(enrolledStudentSearch.toLowerCase()) ||
      s.enrollment_number?.toLowerCase().includes(enrolledStudentSearch.toLowerCase())
    );
  }, [enrollmentData?.enrolledStudents, enrolledStudentSearch]);

  const availableStudents = useMemo(() => {
    if (!enrollmentData?.availableStudents) return [];
    if (!studentSearch) return enrollmentData.availableStudents;
    return enrollmentData.availableStudents.filter(s =>
      s.profile?.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.enrollment_number?.toLowerCase().includes(studentSearch.toLowerCase())
    );
  }, [enrollmentData?.availableStudents, studentSearch]);

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleEnroll = async () => {
    if (selectedStudents.length === 0) return;
    await enrollStudents.mutateAsync({
      classId: classData.id,
      studentIds: selectedStudents,
    });
    setSelectedStudents([]);
  };

  const handleUnenroll = async (studentId: string) => {
    await unenrollStudent.mutateAsync({
      classId: classData.id,
      studentId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Class — {classData.name}</DialogTitle>
          <DialogDescription>Update details, assign teacher, or manage students</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="gap-1.5 text-xs sm:text-sm">
              <Settings className="h-3.5 w-3.5" /> Details
            </TabsTrigger>
            <TabsTrigger value="teacher" className="gap-1.5 text-xs sm:text-sm">
              <UserCog className="h-3.5 w-3.5" /> Teacher
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-1.5 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5" /> Students
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Class Name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-grade">Grade</Label>
                <Input id="edit-grade" value={grade} onChange={(e) => setGrade(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-section">Section</Label>
                <Input id="edit-section" value={section} onChange={(e) => setSection(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-program">Language</Label>
                <Input id="edit-program" value={program} onChange={(e) => setProgram(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-level">Level</Label>
                <Input id="edit-level" value={levelLabel} onChange={(e) => setLevelLabel(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-capacity">Capacity</Label>
                <Input id="edit-capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-monthly-fee">Monthly Fee ($)</Label>
                <Input
                  id="edit-monthly-fee"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Leave monthly fee empty or 0 to use the school default. Students in this class will be invoiced at this rate.</p>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveDetails} disabled={!name.trim() || updateClass.isPending}>
                {updateClass.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Details
              </Button>
            </div>
          </TabsContent>

          {/* Teacher Tab */}
          <TabsContent value="teacher" className="flex-1 min-h-0 flex flex-col gap-3 mt-4">
            {/* Enrolled teachers */}
            {enrolledTeachers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Enrolled ({enrolledTeachers.length})
                </Label>
                <ScrollArea className="max-h-[120px]">
                  <div className="flex flex-wrap gap-1.5">
                    {enrolledTeachers.map((ct) => (
                      <Badge key={ct.id} variant="secondary" className="gap-1 pr-1">
                        {ct.profile?.full_name || 'Unknown'}
                        {ct.role !== 'assistant' && (
                          <span className="text-[10px] text-muted-foreground ml-0.5">({ct.role})</span>
                        )}
                        <button
                          onClick={() => handleUnenrollTeacher(ct.teacher_id)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                          disabled={unenrollTeacher.isPending}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Search + Select All */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search available teachers..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {availableTeachers.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 text-xs"
                  onClick={selectAllTeachers}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  {selectedTeachers.length === availableTeachers.length ? 'Deselect' : 'Select All'}
                </Button>
              )}
            </div>

            {teachersLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : availableTeachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <UserCog className="h-8 w-8 text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">
                  {teacherSearch ? 'No teachers match your search' : 'All teachers are enrolled'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[180px] pr-2">
                <div className="space-y-1">
                  {availableTeachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleTeacher(teacher.id)}
                    >
                      <Checkbox
                        checked={selectedTeachers.includes(teacher.id)}
                        onCheckedChange={() => toggleTeacher(teacher.id)}
                      />
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {teacher.profile?.full_name?.charAt(0) || 'T'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {teacher.profile?.full_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {teacher.department || teacher.employee_id || 'Teacher'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {selectedTeachers.length > 0 && (
              <div className="flex justify-end">
                <Button size="sm" onClick={handleEnrollTeachers} disabled={enrollTeachers.isPending}>
                  {enrollTeachers.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Enroll {selectedTeachers.length}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students" className="flex-1 min-h-0 flex flex-col gap-3 mt-4">
            {/* Enrolled students */}
            {enrollmentData?.enrolledStudents && enrollmentData.enrolledStudents.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  Enrolled ({enrollmentData.enrolledStudents.length})
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search enrolled students..."
                    value={enrolledStudentSearch}
                    onChange={(e) => setEnrolledStudentSearch(e.target.value)}
                    className="pl-9 h-8 text-xs"
                  />
                </div>
                <ScrollArea className="h-[160px] pr-2">
                  {filteredEnrolledStudents.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">No enrolled students match your search</p>
                  ) : (
                    <div className="space-y-1">
                      {filteredEnrolledStudents.map((s) => (
                        <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 group">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs">
                              {s.profile?.full_name?.charAt(0) || 'S'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{s.profile?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{s.enrollment_number || 'No ID'}</p>
                          </div>
                          <button
                            onClick={() => handleUnenroll(s.id)}
                            className="opacity-0 group-hover:opacity-100 rounded-full p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                            disabled={unenrollStudent.isPending}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            {/* Add students */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search available students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {enrollmentLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : availableStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Users className="h-8 w-8 text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">
                  {studentSearch ? 'No students match your search' : 'All students are enrolled'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[180px] pr-2">
                <div className="space-y-1">
                  {availableStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleStudent(student.id)}
                    >
                      <Checkbox
                        checked={selectedStudents.includes(student.id)}
                        onCheckedChange={() => toggleStudent(student.id)}
                      />
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {student.profile?.full_name?.charAt(0) || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {student.profile?.full_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {student.enrollment_number || 'No ID'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {selectedStudents.length > 0 && (
              <div className="flex justify-end">
                <Button size="sm" onClick={handleEnroll} disabled={enrollStudents.isPending}>
                  {enrollStudents.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Enroll {selectedStudents.length}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
