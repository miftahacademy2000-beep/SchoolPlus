import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { useTeachers, useDeleteTeacher, type TeacherWithProfile } from '@/hooks/useTeachers';
import { AddTeacherModal } from '@/components/users/AddTeacherModal';
import { EditTeacherModal } from '@/components/users/EditTeacherModal';
import { Search, Users, Loader2, MoreVertical, Mail, Building2, BookOpen, Trash2, Edit, Plus } from 'lucide-react';

export default function TeachersPage() {
  const [search, setSearch] = useState('');
  const [teacherToDelete, setTeacherToDelete] = useState<TeacherWithProfile | null>(null);
  const [teacherToEdit, setTeacherToEdit] = useState<TeacherWithProfile | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const { data: teachers, isLoading, error } = useTeachers();
  const deleteTeacher = useDeleteTeacher();

  const filteredTeachers = teachers?.filter((teacher) => {
    const matchesSearch =
      !search ||
      teacher.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      teacher.profile?.email?.toLowerCase().includes(search.toLowerCase()) ||
      teacher.department?.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  const handleDelete = async () => {
    if (!teacherToDelete) return;
    await deleteTeacher.mutateAsync({
      originalId: teacherToDelete.id,
      userId: teacherToDelete.user_id,
      schoolId: teacherToDelete.school_id,
      userType: 'teacher',
      fullName: teacherToDelete.profile?.full_name || null,
      email: teacherToDelete.profile?.email || null,
      phone: teacherToDelete.profile?.phone || null,
      avatarUrl: teacherToDelete.profile?.avatar_url || null,
      metadata: {
        employee_id: teacherToDelete.employee_id,
        department: teacherToDelete.department,
        subjects: teacherToDelete.subjects,
      },
    });
    setTeacherToDelete(null);
  };

  const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.[0]?.toUpperCase() || '?';
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Teachers"
        description="Manage school teachers"
        breadcrumbs={[{ label: 'Teachers' }]}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teachers by name, email, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Teacher
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <Users className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Error loading teachers</h2>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      ) : filteredTeachers?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No teachers found</h2>
          <p className="text-sm text-muted-foreground">
            {search ? 'Try adjusting your search' : 'Teachers will appear here once added'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTeachers?.map((teacher) => (
            <Card key={teacher.id} className="overflow-hidden transition-all hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 border-2 border-border">
                    <AvatarImage src={teacher.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-teacher/10 text-teacher font-medium">
                      {getInitials(teacher.profile?.full_name, teacher.profile?.email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-foreground truncate">
                        {teacher.profile?.full_name || 'Unnamed Teacher'}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            className="gap-2"
                            onClick={() => setTeacherToEdit(teacher)}
                          >
                            <Edit className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 text-destructive"
                            onClick={() => setTeacherToDelete(teacher)}
                          >
                            <Trash2 className="h-4 w-4" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {teacher.profile?.email && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{teacher.profile.email}</span>
                      </div>
                    )}

                    {teacher.department && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{teacher.department}</span>
                      </div>
                    )}

                    {teacher.employee_id && (
                      <div className="text-xs text-muted-foreground mt-1">
                        ID: {teacher.employee_id}
                      </div>
                    )}

                    {teacher.subjects && teacher.subjects.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {teacher.subjects.slice(0, 3).map((subject, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            <BookOpen className="h-3 w-3 mr-1" />
                            {subject}
                          </Badge>
                        ))}
                        {teacher.subjects.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{teacher.subjects.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!teacherToDelete} onOpenChange={() => setTeacherToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Teacher</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove <strong>{teacherToDelete?.profile?.full_name}</strong> from the school? Their record will be archived and can be restored later.
                </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddTeacherModal open={showAddModal} onOpenChange={setShowAddModal} />
      
      {teacherToEdit && (
        <EditTeacherModal 
          open={!!teacherToEdit} 
          onOpenChange={(open) => !open && setTeacherToEdit(null)} 
          teacher={teacherToEdit}
        />
      )}
    </DashboardLayout>
  );
}
