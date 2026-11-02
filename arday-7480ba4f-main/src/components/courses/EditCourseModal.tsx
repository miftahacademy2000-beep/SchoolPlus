import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useUpdateCourse, Course } from '@/hooks/useCourses';
import { useTeachers } from '@/hooks/useTeachers';

const formSchema = z.object({
  name: z.string().min(1, 'Course name is required'),
  code: z.string().min(1, 'Course code is required'),
  description: z.string().optional(),
  credits: z.coerce.number().min(1).max(10).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EditCourseModalProps {
  course: Course | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCourseModal({ course, open, onOpenChange }: EditCourseModalProps) {
  const updateCourse = useUpdateCourse();
  const { data: teachers = [] } = useTeachers();
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (course) {
      reset({
        name: course.name,
        code: course.code,
        description: course.description || '',
        credits: course.credits || 3,
      });
      setSelectedTeacher(course.teacher_id || '');
    }
  }, [course, reset]);

  const onSubmit = async (data: FormData) => {
    if (!course) return;
    
    await updateCourse.mutateAsync({
      id: course.id,
      name: data.name,
      code: data.code,
      description: data.description || null,
      credits: data.credits,
      teacher_id: selectedTeacher || null,
    });
    onOpenChange(false);
  };

  if (!course) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Course</DialogTitle>
          <DialogDescription>
            Update the course information.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Course Name *</Label>
              <Input
                id="name"
                placeholder="Mathematics 101"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Course Code *</Label>
              <Input
                id="code"
                placeholder="MATH101"
                {...register('code')}
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Course description..."
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="credits">Credits</Label>
              <Input
                id="credits"
                type="number"
                min={1}
                max={10}
                {...register('credits')}
              />
            </div>
            <div className="space-y-2">
              <Label>Assigned Teacher</Label>
              <Select value={selectedTeacher || "none"} onValueChange={(val) => setSelectedTeacher(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No teacher assigned</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.profile?.full_name || teacher.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateCourse.isPending}>
              {updateCourse.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
