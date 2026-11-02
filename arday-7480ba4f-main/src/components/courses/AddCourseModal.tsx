import { useState } from 'react';
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
import { useCreateCourse } from '@/hooks/useCourses';
import { useTeachers } from '@/hooks/useTeachers';

const formSchema = z.object({
  name: z.string().min(1, 'Course name is required'),
  code: z.string().min(1, 'Course code is required'),
  description: z.string().optional(),
  credits: z.coerce.number().min(1).max(10).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCourseModal({ open, onOpenChange }: AddCourseModalProps) {
  const createCourse = useCreateCourse();
  const { data: teachers = [] } = useTeachers();
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      credits: 3,
    },
  });

  const onSubmit = async (data: FormData) => {
    await createCourse.mutateAsync({
      name: data.name,
      code: data.code,
      description: data.description,
      credits: data.credits,
      teacher_id: selectedTeacher || undefined,
    });
    reset();
    setSelectedTeacher('');
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
      setSelectedTeacher('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Course</DialogTitle>
          <DialogDescription>
            Create a new course for your school.
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
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCourse.isPending}>
              {createCourse.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Course
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
