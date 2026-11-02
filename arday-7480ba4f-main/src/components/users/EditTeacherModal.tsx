import { useState, useEffect, useRef } from 'react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useUpdateTeacher, type TeacherWithProfile } from '@/hooks/useTeachers';
import { useUpdateCredentials } from '@/hooks/useUpdateCredentials';
import { Loader2, X, Plus, KeyRound, IdCard } from 'lucide-react';

const formSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email').max(255).optional().or(z.literal('')),
  employee_id: z.string().optional(),
  department: z.string().optional(),
  new_login_id: z.string()
    .max(20, 'Login ID must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]*$/, 'Only letters, numbers, hyphens, underscores')
    .optional().or(z.literal('')),
  new_password: z.string()
    .optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

interface EditTeacherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: TeacherWithProfile;
}

export function EditTeacherModal({ open, onOpenChange, teacher }: EditTeacherModalProps) {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  
  const updateTeacher = useUpdateTeacher();
  const updateCredentials = useUpdateCredentials();

  // Extract login ID from employee_id or email
  const currentLoginId = teacher.employee_id || '';

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: teacher.profile?.full_name || '',
      email: teacher.profile?.email || '',
      employee_id: teacher.employee_id || '',
      department: teacher.department || '',
      new_login_id: '',
      new_password: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        full_name: teacher.profile?.full_name || '',
        email: teacher.profile?.email || '',
        employee_id: teacher.employee_id || '',
        department: teacher.department || '',
        new_login_id: '',
        new_password: '',
      });
      setSubjects(teacher.subjects || []);
      
      // Scroll to top when modal opens
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }
  }, [open, teacher, form]);

  const handleAddSubject = () => {
    if (subjectInput.trim() && !subjects.includes(subjectInput.trim())) {
      setSubjects([...subjects, subjectInput.trim()]);
      setSubjectInput('');
    }
  };

  const handleRemoveSubject = (subject: string) => {
    setSubjects(subjects.filter(s => s !== subject));
  };

  const onSubmit = async (data: FormData) => {
    // Update profile & teacher fields
    await updateTeacher.mutateAsync({
      id: teacher.id,
      user_id: teacher.user_id,
      full_name: data.full_name,
      email: data.email || undefined,
      employee_id: data.employee_id || undefined,
      department: data.department || undefined,
      subjects: subjects.length > 0 ? subjects : undefined,
    });

    // Update credentials if provided
    const hasLoginIdChange = data.new_login_id && data.new_login_id.length >= 3;
    const hasPasswordChange = data.new_password && data.new_password.length >= 6;

    if (hasLoginIdChange || hasPasswordChange) {
      await updateCredentials.mutateAsync({
        user_id: teacher.user_id,
        school_id: teacher.school_id,
        role: 'teacher',
        new_login_id: hasLoginIdChange ? data.new_login_id : undefined,
        new_password: hasPasswordChange ? data.new_password : undefined,
      });
    }

    onOpenChange(false);
  };

  const isPending = updateTeacher.isPending || updateCredentials.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={contentRef} className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Teacher</DialogTitle>
          <DialogDescription>
            Update information for {teacher.profile?.full_name || 'this teacher'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Teacher name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="employee_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID</FormLabel>
                  <FormControl>
                    <Input placeholder="EMP-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl>
                    <Input placeholder="Science" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Subjects</FormLabel>
              <div className="flex gap-2">
                <Input
                  placeholder="Add subject"
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubject();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={handleAddSubject}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {subjects.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {subjects.map((subject) => (
                    <Badge key={subject} variant="secondary" className="gap-1">
                      {subject}
                      <button
                        type="button"
                        onClick={() => handleRemoveSubject(subject)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-1">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                Login Credentials
              </h4>
              <p className="text-xs text-muted-foreground">
                Current Login ID: <span className="font-medium text-foreground">{currentLoginId || 'Not set'}</span>
              </p>
            </div>

            <FormField
              control={form.control}
              name="new_login_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Login ID</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Leave empty to keep current" 
                        className="pl-10"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Min 3 characters. Only letters, numbers, hyphens, underscores.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reset Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Leave empty to keep current" {...field} />
                  </FormControl>
                  <FormDescription>Min 6 characters. User will be prompted to change on next login.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
