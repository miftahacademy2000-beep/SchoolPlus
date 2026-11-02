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
import { useCreateUser } from '@/hooks/useCreateUser';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { Loader2, X, Plus, IdCard } from 'lucide-react';

const formSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  login_id: z.string()
    .min(3, 'Login ID must be at least 3 characters')
    .max(20, 'Login ID must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Login ID can only contain letters, numbers, hyphens, and underscores'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  employee_id: z.string().optional(),
  department: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddTeacherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTeacherModal({ open, onOpenChange }: AddTeacherModalProps) {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState('');
  
  const { currentSchoolId } = useSchoolContext();
  const createUser = useCreateUser();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: '',
      login_id: '',
      password: '',
      employee_id: '',
      department: '',
    },
  });

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
    if (!currentSchoolId) return;

    await createUser.mutateAsync({
      full_name: data.full_name,
      login_id: data.login_id,
      password: data.password,
      role: 'teacher',
      school_id: currentSchoolId,
      employee_id: data.employee_id || data.login_id,
      department: data.department,
      subjects: subjects.length > 0 ? subjects : undefined,
    });

    form.reset();
    setSubjects([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Teacher</DialogTitle>
          <DialogDescription>
            Create a new teacher account. They will use their Login ID and password to sign in.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="overflow-y-auto flex-1 space-y-4 pr-1">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="login_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Login ID *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="teacher001" 
                        className="pl-10"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Teachers will use this ID to log in (instead of email)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password *</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Min 6 characters" {...field} />
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
                    <Input placeholder="Optional (defaults to Login ID)" {...field} />
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

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Teacher
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}