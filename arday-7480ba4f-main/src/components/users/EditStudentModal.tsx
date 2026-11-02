import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, KeyRound, IdCard } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { type StudentWithProfile } from '@/hooks/useStudents';
import { useUpdateCredentials } from '@/hooks/useUpdateCredentials';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(31),
  email: z.string().trim().email('Invalid email').max(38).optional().or(z.literal('')),
  enrollment_number: z.string().max(17).optional(),
  grade: z.string().max(13).optional(),
  date_of_birth: z.date().optional().nullable(),
  phone: z.string().trim().max(26).optional(),
  new_login_id: z.string()
    .max(20, 'Login ID must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]*$/, 'Only letters, numbers, hyphens, underscores')
    .optional().or(z.literal('')),
  new_password: z.string()
    .optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

interface EditStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentWithProfile;
}

export function EditStudentModal({ open, onOpenChange, student }: EditStudentModalProps) {
  const updateCredentials = useUpdateCredentials();
  const contentRef = useRef<HTMLDivElement>(null);

  const currentLoginId = (() => {
    if (student.profile?.login_id) return student.profile.login_id;
    const email = student.profile?.email || '';
    if (!email) return '';
    const username = email.split('@')[0] || '';
    if (!username) return '';
    return username.includes('.') ? username.split('.')[0] : username;
  })();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: student.profile?.full_name || '',
      email: student.profile?.email || '',
      enrollment_number: student.enrollment_number || '',
      grade: student.grade || '',
      date_of_birth: student.date_of_birth ? new Date(student.date_of_birth + 'T00:00:00') : null,
      phone: student.profile?.phone || '',
      new_login_id: '',
      new_password: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        full_name: student.profile?.full_name || '',
        email: student.profile?.email || '',
        enrollment_number: student.enrollment_number || '',
        grade: student.grade || '',
        date_of_birth: student.date_of_birth ? new Date(student.date_of_birth + 'T00:00:00') : null,
        phone: student.profile?.phone || '',
        new_login_id: '',
        new_password: '',
      });
      // Scroll to top when modal opens
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }
  }, [open, student, form]);

  const onSubmit = async (data: FormData) => {
    const hasLoginIdChange = data.new_login_id && data.new_login_id.length >= 3;
    const hasPasswordChange = data.new_password && data.new_password.length >= 6;

    // Route everything through the edge function which uses admin privileges
    await updateCredentials.mutateAsync({
      user_id: student.user_id,
      school_id: student.school_id,
      role: 'student',
      // Profile fields
      full_name: data.full_name,
      phone: data.phone || '',
      // Student fields
      enrollment_number: data.enrollment_number || undefined,
      grade: data.grade || undefined,
      date_of_birth: data.date_of_birth ? format(data.date_of_birth, 'yyyy-MM-dd') : undefined,
      // Credential fields
      new_login_id: hasLoginIdChange ? data.new_login_id : undefined,
      new_password: hasPasswordChange ? data.new_password : undefined,
    });

    onOpenChange(false);
  };

  const isPending = updateCredentials.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={contentRef} className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
          <DialogDescription>
            Update information for {student.profile?.full_name || 'this student'}
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
                    <Input placeholder="Student name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="enrollment_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Student ID</FormLabel>
                    <FormControl>
                      <Input placeholder="STU-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade</FormLabel>
                    <FormControl>
                      <Input placeholder="10th" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="date_of_birth"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Birth</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? format(field.value, 'dd/MM/yyyy') : <span>dd/mm/yyyy</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
