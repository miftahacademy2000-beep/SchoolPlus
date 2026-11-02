import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  useClasses, 
  useCreateClass, 
  useDeleteClass, 
  useAssignTeacherToClass,
  type ClassWithTeacher 
} from '@/hooks/useClasses';
import { useTeachers } from '@/hooks/useTeachers';
import { EnrollStudentsModal, EditClassModal } from '@/components/classes';
import { 
  Search, 
  BookOpen, 
  Loader2, 
  MoreVertical, 
  Users, 
  UserCog, 
  Trash2, 
  Edit, 
  Plus,
  GraduationCap,
  UserPlus,
  DollarSign
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';

export default function ClassesPage() {
  const [search, setSearch] = useState('');
  const [classToDelete, setClassToDelete] = useState<ClassWithTeacher | null>(null);
  const [classToAssign, setClassToAssign] = useState<ClassWithTeacher | null>(null);
  const [classToEnroll, setClassToEnroll] = useState<ClassWithTeacher | null>(null);
  const [classToEdit, setClassToEdit] = useState<ClassWithTeacher | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('');
  const [newClassSection, setNewClassSection] = useState('');
  const [newClassCapacity, setNewClassCapacity] = useState('30');
  const [newClassMonthlyFee, setNewClassMonthlyFee] = useState('');

  const { data: classes, isLoading, error } = useClasses();
  const { data: teachers } = useTeachers();
  const deleteClass = useDeleteClass();
  const createClass = useCreateClass();
  const assignTeacher = useAssignTeacherToClass();
  const { primaryRole, isSuperAdmin } = useAuth();
  
  // Teachers can only view their classes, not manage
  const canManageClasses = isSuperAdmin || primaryRole === 'school_admin';
  const isTeacher = primaryRole === 'teacher';

  const filteredClasses = classes?.filter((cls) => {
    const matchesSearch =
      !search ||
      cls.name.toLowerCase().includes(search.toLowerCase()) ||
      cls.grade?.toLowerCase().includes(search.toLowerCase()) ||
      cls.section?.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  const handleDelete = async () => {
    if (!classToDelete) return;
    await deleteClass.mutateAsync(classToDelete.id);
    setClassToDelete(null);
  };

  const handleAssignTeacher = async () => {
    if (!classToAssign) return;
    await assignTeacher.mutateAsync({
      classId: classToAssign.id,
      teacherId: selectedTeacher === 'none' ? null : selectedTeacher || null,
    });
    setClassToAssign(null);
    setSelectedTeacher('');
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    const fee = parseFloat(newClassMonthlyFee);
    await createClass.mutateAsync({
      name: newClassName,
      grade: newClassGrade || undefined,
      section: newClassSection || undefined,
      capacity: parseInt(newClassCapacity) || 30,
      monthly_fee: !isNaN(fee) && fee > 0 ? fee : null,
    });
    setCreateDialogOpen(false);
    setNewClassName('');
    setNewClassGrade('');
    setNewClassSection('');
    setNewClassCapacity('30');
    setNewClassMonthlyFee('');
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={isTeacher ? "My Classes" : "Classes"}
        description={isTeacher ? "View your assigned classes" : "Manage school classes and sections"}
        breadcrumbs={[{ label: isTeacher ? 'My Classes' : 'Classes' }]}
        actions={
          canManageClasses && (
            <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Class
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search classes by name, grade, or section..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <BookOpen className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Error loading classes</h2>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      ) : filteredClasses?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No classes found</h2>
          <p className="text-sm text-muted-foreground">
            {search 
              ? 'Try adjusting your search' 
              : isTeacher 
                ? 'You have no classes assigned yet' 
                : 'Create a class to get started'}
          </p>
          {!search && canManageClasses && (
            <Button className="mt-4 gap-2" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Class
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClasses?.map((cls) => (
            <Card key={cls.id} className="overflow-hidden transition-all hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{cls.name}</CardTitle>
                  {canManageClasses && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2" onClick={() => setClassToEdit(cls)}>
                          <Edit className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2"
                          onClick={() => setClassToEnroll(cls)}
                        >
                          <UserPlus className="h-4 w-4" /> Enroll Students
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2"
                          onClick={() => {
                            setClassToAssign(cls);
                            setSelectedTeacher(cls.teacher_id || '');
                          }}
                        >
                          <UserCog className="h-4 w-4" /> Assign Teacher
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2 text-destructive"
                          onClick={() => setClassToDelete(cls)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  {cls.grade && (
                    <Badge variant="secondary">
                      <GraduationCap className="h-3 w-3 mr-1" />
                      {cls.grade}
                    </Badge>
                  )}
                  {cls.section && (
                    <Badge variant="outline">Section {cls.section}</Badge>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span>Students</span>
                    </div>
                    <span className="font-medium text-foreground">
                      {cls.student_count || 0} / {cls.capacity || 30}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <UserCog className="h-4 w-4" />
                      <span>Teacher</span>
                    </div>
                    <span className="font-medium text-foreground truncate max-w-[120px]">
                      {cls.teacher?.profile?.full_name || 'Not assigned'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4" />
                      <span>Monthly Fee</span>
                    </div>
                    <span className="font-medium text-foreground">
                      {cls.monthly_fee != null && cls.monthly_fee > 0
                        ? `$${Number(cls.monthly_fee).toFixed(2)}`
                        : <span className="text-muted-foreground">Default</span>}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Class Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
            <DialogDescription>Add a new class to your school</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Class Name</Label>
              <Input
                id="name"
                placeholder="e.g., Class 10-A"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="grade">Grade</Label>
                <Input
                  id="grade"
                  placeholder="e.g., Grade 10"
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  placeholder="e.g., A"
                  value={newClassSection}
                  onChange={(e) => setNewClassSection(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  placeholder="30"
                  value={newClassCapacity}
                  onChange={(e) => setNewClassCapacity(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="monthly-fee">Monthly Fee ($)</Label>
                <Input
                  id="monthly-fee"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={newClassMonthlyFee}
                  onChange={(e) => setNewClassMonthlyFee(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leave empty to use school default</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateClass} disabled={!newClassName.trim() || createClass.isPending}>
              {createClass.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Teacher Dialog */}
      <Dialog open={!!classToAssign} onOpenChange={() => setClassToAssign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher</DialogTitle>
            <DialogDescription>
              Assign a teacher to {classToAssign?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="teacher">Select Teacher</Label>
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose a teacher" />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassToAssign(null)}>
              Cancel
            </Button>
            <Button onClick={handleAssignTeacher} disabled={assignTeacher.isPending}>
              {assignTeacher.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!classToDelete} onOpenChange={() => setClassToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{classToDelete?.name}</strong>? This will remove all enrollments and cannot be undone.
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

      {/* Edit Class Modal */}
      {classToEdit && (
        <EditClassModal
          open={!!classToEdit}
          onOpenChange={(open) => !open && setClassToEdit(null)}
          classData={classToEdit}
          onSaved={(updated) => setClassToEdit(updated)}
        />
      )}

      {/* Enroll Students Modal */}
      {classToEnroll && (
        <EnrollStudentsModal
          open={!!classToEnroll}
          onOpenChange={(open) => !open && setClassToEnroll(null)}
          classId={classToEnroll.id}
          className={classToEnroll.name}
        />
      )}
    </DashboardLayout>
  );
}
