import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, BookOpen, Loader2, Eye } from 'lucide-react';
import { useCourses, useDeleteCourse, Course } from '@/hooks/useCourses';
import { AddCourseModal, EditCourseModal } from '@/components/courses';
import { useAuth } from '@/contexts/AuthContext';

export default function CoursesPage() {
  const navigate = useNavigate();
  const { data: courses = [], isLoading } = useCourses();
  const deleteCourse = useDeleteCourse();
  const { primaryRole, isSuperAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  // Only super_admin and school_admin can manage courses (add/edit/delete)
  // Teachers can only view their assigned courses
  const canManageCourses = isSuperAdmin || primaryRole === 'school_admin';
  const isTeacher = primaryRole === 'teacher';

  const filteredCourses = courses.filter((course) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      course.name.toLowerCase().includes(searchLower) ||
      course.code.toLowerCase().includes(searchLower) ||
      course.teacher?.profile?.full_name?.toLowerCase().includes(searchLower)
    );
  });

  const handleDelete = async () => {
    if (courseToDelete) {
      await deleteCourse.mutateAsync(courseToDelete.id);
      setCourseToDelete(null);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={isTeacher ? "My Courses" : "Courses"}
        description={isTeacher ? "View your assigned courses" : canManageCourses ? "Manage courses and curriculum" : "View available courses"}
        breadcrumbs={[{ label: isTeacher ? 'My Courses' : 'Courses' }]}
      />

      <div className="space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {canManageCourses && (
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Course
            </Button>
          )}
        </div>

        {/* Courses Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No courses found</h3>
                <p className="text-muted-foreground mt-1">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : canManageCourses
                    ? 'Get started by adding your first course'
                    : 'No courses are available yet'}
                </p>
                {!searchQuery && canManageCourses && (
                  <Button className="mt-4" onClick={() => setShowAddModal(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Course
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCourses.map((course) => (
                    <TableRow 
                      key={course.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{course.name}</div>
                          {course.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {course.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{course.code}</Badge>
                      </TableCell>
                      <TableCell>
                        {course.teacher?.profile?.full_name || (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>{course.credits || 3}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => navigate(`/courses/${course.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canManageCourses && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setCourseToEdit(course)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setCourseToDelete(course)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals - only render if user can manage */}
      {canManageCourses && (
        <>
          <AddCourseModal open={showAddModal} onOpenChange={setShowAddModal} />
          <EditCourseModal
            course={courseToEdit}
            open={!!courseToEdit}
            onOpenChange={(open) => !open && setCourseToEdit(null)}
          />

          {/* Delete Confirmation */}
          <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Course</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{courseToDelete?.name}"? This action cannot be undone.
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
