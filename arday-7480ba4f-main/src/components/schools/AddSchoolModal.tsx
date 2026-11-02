import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Loader2, UserPlus } from 'lucide-react';
import { z } from 'zod';
import { schoolSchema, generateSlug } from '@/lib/validations/school';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// Extend school schema with admin fields
const addSchoolWithAdminSchema = schoolSchema.extend({
  adminFullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters'),
  adminEmail: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters'),
  adminPassword: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be less than 128 characters'),
});

type AddSchoolWithAdminData = z.infer<typeof addSchoolWithAdminSchema>;

interface AddSchoolModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddSchoolModal({ open, onOpenChange, onSuccess }: AddSchoolModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AddSchoolWithAdminData>({
    resolver: zodResolver(addSchoolWithAdminSchema),
    defaultValues: {
      name: '',
      slug: '',
      email: '',
      phone: '',
      address: '',
      adminFullName: '',
      adminEmail: '',
      adminPassword: '',
    },
  });

  // Auto-generate slug from name
  const watchName = form.watch('name');
  useEffect(() => {
    if (watchName && !form.getValues('slug')) {
      form.setValue('slug', generateSlug(watchName), { shouldValidate: true });
    }
  }, [watchName, form]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    form.setValue('name', name);
    const currentSlug = form.getValues('slug');
    if (!currentSlug || currentSlug === generateSlug(form.getValues('name').slice(0, -1))) {
      form.setValue('slug', generateSlug(name), { shouldValidate: true });
    }
  };

  const onSubmit = async (data: AddSchoolWithAdminData) => {
    setError(null);
    setIsSubmitting(true);

    try {
      // Check if slug already exists
      const existingResponse = await api.get<{ data: { id: string } | null }>('/schools', { params: { slug: data.slug } });
      const existingSchool = existingResponse.data;

      if (existingSchool) {
        setError('A school with this slug already exists. Please choose a different slug.');
        setIsSubmitting(false);
        return;
      }

      // Insert new school
      const newSchoolResponse = await api.post<{ data: { id: string } }>('/schools', {
        name: data.name,
        slug: data.slug,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        status: 'pending',
        plan: 'free',
      });

      const newSchoolId = newSchoolResponse.data?.id;
      if (!newSchoolId) {
        throw new Error('Failed to create school');
      }

      // Create school admin user via API
      const response = await api.post<{ data?: unknown; error?: string }>('/users', {
        email: data.adminEmail,
        password: data.adminPassword,
        full_name: data.adminFullName,
        role: 'school_admin',
        school_id: newSchoolId,
      });

      if (response.error) {
        // School was created but admin failed - warn user
        toast.warning('School created, but failed to create admin account: ' + response.error);
      } else {
        toast.success('School and admin account created successfully!');
      }

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Error creating school:', err);
      setError(err.message || 'Failed to create school. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!isSubmitting) {
      form.reset();
      setError(null);
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Add New School</DialogTitle>
              <DialogDescription>Create a new school with an admin account</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter school name"
                      {...field}
                      onChange={handleNameChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Slug *</FormLabel>
                  <FormControl>
                    <Input placeholder="school-slug" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Used in URLs. Only lowercase letters, numbers, and hyphens.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="admin@school.edu" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter school address"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <UserPlus className="h-4 w-4" />
              School Admin Account
            </div>

            <FormField
              control={form.control}
              name="adminFullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Full Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adminEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="admin@school.edu" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adminPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Password *</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Minimum 6 characters" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    The admin will be prompted to change this on first login.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create School'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}