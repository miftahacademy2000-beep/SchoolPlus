import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Button } from '@/components/ui/button';
import { useLinkParentToStudent, type ParentWithProfile } from '@/hooks/useParents';
import { useStudents, type StudentWithProfile } from '@/hooks/useStudents';
import { Loader2, GraduationCap } from 'lucide-react';

const linkSchema = z.object({
  studentId: z.string().min(1, 'Please select a student'),
  relationship: z.string().min(1, 'Please select a relationship'),
});

type LinkFormData = z.infer<typeof linkSchema>;

interface LinkStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent: ParentWithProfile;
}

const relationshipOptions = [
  { value: 'parent', label: 'Parent' },
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'other', label: 'Other' },
];

export function LinkStudentModal({ open, onOpenChange, parent }: LinkStudentModalProps) {
  const { data: students, isLoading: loadingStudents } = useStudents();
  const linkStudent = useLinkParentToStudent();

  const form = useForm<LinkFormData>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      studentId: '',
      relationship: 'parent',
    },
  });

  // Filter out students that are already linked to this parent
  const linkedStudentIds = new Set(parent.children?.map(c => c.student_id) || []);
  const availableStudents = students?.filter(s => !linkedStudentIds.has(s.id)) || [];

  const onSubmit = async (data: LinkFormData) => {
    await linkStudent.mutateAsync({
      parentId: parent.user_id,
      studentId: data.studentId,
      relationship: data.relationship,
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Link Student
          </DialogTitle>
          <DialogDescription>
            Link a student to {parent.profile?.full_name || 'this parent'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="studentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loadingStudents ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : availableStudents.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          No available students to link
                        </div>
                      ) : (
                        availableStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.profile?.full_name || 'Unnamed Student'}
                            {student.grade && ` (${student.grade})`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="relationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {relationshipOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={linkStudent.isPending || availableStudents.length === 0}
              >
                {linkStudent.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Link Student
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
