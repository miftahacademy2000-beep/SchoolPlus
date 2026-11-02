import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateAssignment, type Assignment } from '@/hooks/useAssignments';
import { useCourses } from '@/hooks/useCourses';
import { useClasses } from '@/hooks/useClasses';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const assignmentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  course_id: z.string().min(1, 'Course is required'),
  class_id: z.string().optional(),
  due_date: z.string().min(1, 'Due date is required'),
  max_score: z.coerce.number().min(1).default(100),
  assignment_type: z.enum(['homework', 'quiz', 'exam', 'project', 'lab']).default('homework'),
  status: z.enum(['draft', 'published']).default('draft'),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

interface EditAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment;
}

export function EditAssignmentModal({ open, onOpenChange, assignment }: EditAssignmentModalProps) {
  const updateAssignment = useUpdateAssignment();
  const { data: courses } = useCourses();
  const { data: classes } = useClasses();

  const form = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: assignment.title,
      description: assignment.description || '',
      course_id: assignment.course_id,
      class_id: assignment.class_id || '',
      due_date: format(new Date(assignment.due_date), "yyyy-MM-dd'T'HH:mm"),
      max_score: assignment.max_score,
      assignment_type: assignment.assignment_type as 'homework' | 'quiz' | 'exam' | 'project' | 'lab',
      status: assignment.status as 'draft' | 'published',
    },
  });

  useEffect(() => {
    form.reset({
      title: assignment.title,
      description: assignment.description || '',
      course_id: assignment.course_id,
      class_id: assignment.class_id || '',
      due_date: format(new Date(assignment.due_date), "yyyy-MM-dd'T'HH:mm"),
      max_score: assignment.max_score,
      assignment_type: assignment.assignment_type as 'homework' | 'quiz' | 'exam' | 'project' | 'lab',
      status: assignment.status as 'draft' | 'published',
    });
  }, [assignment, form]);

  const onSubmit = async (data: AssignmentFormData) => {
    await updateAssignment.mutateAsync({
      id: assignment.id,
      ...data,
      class_id: data.class_id || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Assignment title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Assignment description and instructions..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="course_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courses?.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.code} - {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="class_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">All Classes</SelectItem>
                        {classes?.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assignment_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="homework">Homework</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="exam">Exam</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                        <SelectItem value="lab">Lab</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Score</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateAssignment.isPending}>
                {updateAssignment.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
