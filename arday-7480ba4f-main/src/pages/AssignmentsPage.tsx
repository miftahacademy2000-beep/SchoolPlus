import { useState } from 'react';
import { DashboardLayout, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeacherAssignments, useDeleteAssignment, type Assignment } from '@/hooks/useAssignments';
import { AddAssignmentModal, EditAssignmentModal } from '@/components/assignments';
import { 
  Search, 
  FileText, 
  Loader2, 
  MoreVertical, 
  Trash2, 
  Edit, 
  Plus,
  Calendar,
  BookOpen,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { format, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';

export default function AssignmentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [assignmentToEdit, setAssignmentToEdit] = useState<Assignment | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: assignments, isLoading, error } = useTeacherAssignments();
  const deleteAssignment = useDeleteAssignment();

  const filteredAssignments = assignments?.filter((assignment) => {
    const matchesSearch =
      !search ||
      assignment.title.toLowerCase().includes(search.toLowerCase()) ||
      assignment.course?.name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || assignment.status === statusFilter;
    const matchesType = typeFilter === 'all' || assignment.assignment_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const handleDelete = async () => {
    if (!assignmentToDelete) return;
    await deleteAssignment.mutateAsync(assignmentToDelete.id);
    setAssignmentToDelete(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-primary/10 text-primary">Published</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      homework: 'bg-secondary text-secondary-foreground',
      quiz: 'bg-accent text-accent-foreground',
      exam: 'bg-destructive/10 text-destructive',
      project: 'bg-muted text-muted-foreground',
      lab: 'bg-primary/20 text-primary',
    };
    return <Badge className={colors[type] || 'bg-secondary text-secondary-foreground'}>{type.charAt(0).toUpperCase() + type.slice(1)}</Badge>;
  };

  const getDueDateInfo = (dueDate: string) => {
    const date = new Date(dueDate);
    const now = new Date();
    
    if (isPast(date) && !isToday(date)) {
      return { 
        label: 'Overdue', 
        className: 'text-destructive',
        icon: <AlertTriangle className="h-4 w-4" />
      };
    }
    if (isToday(date)) {
      return { 
        label: 'Due today', 
        className: 'text-amber-600 dark:text-amber-400',
        icon: <Clock className="h-4 w-4" />
      };
    }
    if (isTomorrow(date)) {
      return { 
        label: 'Due tomorrow', 
        className: 'text-amber-600 dark:text-amber-400',
        icon: <Clock className="h-4 w-4" />
      };
    }
    const days = differenceInDays(date, now);
    if (days <= 7) {
      return { 
        label: `${days} days left`, 
        className: 'text-muted-foreground',
        icon: <Calendar className="h-4 w-4" />
      };
    }
    return { 
      label: format(date, 'MMM d, yyyy'), 
      className: 'text-muted-foreground',
      icon: <Calendar className="h-4 w-4" />
    };
  };

  // Group assignments by status
  const draftAssignments = filteredAssignments?.filter(a => a.status === 'draft') || [];
  const publishedAssignments = filteredAssignments?.filter(a => a.status === 'published') || [];

  return (
    <DashboardLayout>
      <PageHeader
        title="Assignments"
        description="Create and manage student assignments"
        breadcrumbs={[{ label: 'Assignments' }]}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assignments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="homework">Homework</SelectItem>
            <SelectItem value="quiz">Quiz</SelectItem>
            <SelectItem value="exam">Exam</SelectItem>
            <SelectItem value="project">Project</SelectItem>
            <SelectItem value="lab">Lab</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Assignment
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
            <FileText className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Error loading assignments</h2>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      ) : filteredAssignments?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">No assignments found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {search || statusFilter !== 'all' || typeFilter !== 'all' 
              ? 'Try adjusting your filters' 
              : 'Create your first assignment to get started'}
          </p>
          <Button onClick={() => setShowAddModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Assignment
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Draft Assignments */}
          {draftAssignments.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Edit className="h-5 w-5 text-muted-foreground" />
                Drafts ({draftAssignments.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {draftAssignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onEdit={setAssignmentToEdit}
                    onDelete={setAssignmentToDelete}
                    getStatusBadge={getStatusBadge}
                    getTypeBadge={getTypeBadge}
                    getDueDateInfo={getDueDateInfo}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Published Assignments */}
          {publishedAssignments.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Published ({publishedAssignments.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {publishedAssignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onEdit={setAssignmentToEdit}
                    onDelete={setAssignmentToDelete}
                    getStatusBadge={getStatusBadge}
                    getTypeBadge={getTypeBadge}
                    getDueDateInfo={getDueDateInfo}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!assignmentToDelete} onOpenChange={() => setAssignmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{assignmentToDelete?.title}"? This will also delete all student submissions. This action cannot be undone.
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

      <AddAssignmentModal open={showAddModal} onOpenChange={setShowAddModal} />

      {assignmentToEdit && (
        <EditAssignmentModal
          open={!!assignmentToEdit}
          onOpenChange={(open) => !open && setAssignmentToEdit(null)}
          assignment={assignmentToEdit}
        />
      )}
    </DashboardLayout>
  );
}

interface AssignmentCardProps {
  assignment: Assignment;
  onEdit: (assignment: Assignment) => void;
  onDelete: (assignment: Assignment) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  getTypeBadge: (type: string) => React.ReactNode;
  getDueDateInfo: (dueDate: string) => { label: string; className: string; icon: React.ReactNode };
}

function AssignmentCard({ 
  assignment, 
  onEdit, 
  onDelete, 
  getStatusBadge, 
  getTypeBadge,
  getDueDateInfo 
}: AssignmentCardProps) {
  const dueInfo = getDueDateInfo(assignment.due_date);

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate">
              {assignment.title}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {getTypeBadge(assignment.assignment_type)}
              {getStatusBadge(assignment.status)}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(assignment)} className="gap-2">
                <Edit className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(assignment)}
                className="gap-2 text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {assignment.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {assignment.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <span className="truncate">{assignment.course?.code || 'No course'}</span>
          </div>
          {assignment.class && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="truncate">{assignment.class.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className={`flex items-center gap-1.5 text-sm ${dueInfo.className}`}>
            {dueInfo.icon}
            <span>{dueInfo.label}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {assignment.max_score} pts
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
