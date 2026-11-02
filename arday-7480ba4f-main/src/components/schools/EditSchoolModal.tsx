import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Loader2, KeyRound } from 'lucide-react';
import { z } from 'zod';
import { schoolSchema, type SchoolFormData } from '@/lib/validations/school';
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
import { School } from '@/types';

const editSchoolSchema = schoolSchema.extend({
  adminEmail: z.string().trim().email('Please enter a valid email').max(255).optional().or(z.literal('')),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters').max(128).optional().or(z.literal('')),
});

type EditSchoolFormData = z.infer<typeof editSchoolSchema>;

interface AdminInfo {
  userId: string;
  email: string;
  fullName: string;
}

interface EditSchoolModalProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditSchoolModal({ school, open, onOpenChange, onSuccess }: EditSchoolModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  const form = useForm<EditSchoolFormData>({
    resolver: zodResolver(editSchoolSchema),
    defaultValues: {
      name: '',
      slug: '',
      email: '',
      phone: '',
      address: '',
      adminEmail: '',
      adminPassword: '',
    },
  });

  // Fetch the school admin when modal opens
  useEffect(() => {
    if (school && open) {
      form.reset({
        name: school.name,
        slug: school.slug,
        email: school.email || '',
        phone: school.phone || '',
        address: school.address || '',
        adminEmail: '',
        adminPassword: '',
      });
      setError(null);

      // Fetch school admin
      setLoadingAdmin(true);
      api.get<{ data: { user_id: string }[] }>('/user-roles', { params: { school_id: school.id, role: 'school_admin', limit: 1 } })
        .then((rolesResponse) => {
          const roles = rolesResponse.data || [];
          if (roles.length > 0) {
            const adminUserId = roles[0].user_id;
            api.get<{ data: { id: string; email: string; full_name: string } }>(`/profiles/${adminUserId}`)
              .then((profileResponse) => {
                const profile = profileResponse.data;
                if (profile) {
                  setAdminInfo({
                    userId: profile.id,
                    email: profile.email || '',
                    fullName: profile.full_name || '',
                  });
                  form.setValue('adminEmail', profile.email || '');
                } else {
                  setAdminInfo(null);
                }
                setLoadingAdmin(false);
              });
          } else {
            setAdminInfo(null);
            setLoadingAdmin(false);
          }
        });
    }
  }, [school, open, form]);

  const onSubmit = async (data: EditSchoolFormData) => {
    if (!school) return;
    setError(null);
    setIsSubmitting(true);

    try {
      // Check slug uniqueness
      if (data.slug !== school.slug) {
        const existingResponse = await api.get<{ data: { id: string } | null }>('/schools', { params: { slug: data.slug, exclude_id: school.id } });
        const existing = existingResponse.data;

        if (existing) {
          setError('A school with this slug already exists.');
          setIsSubmitting(false);
          return;
        }
      }

      // Update school record
      await api.put(`/schools/${school.id}`, {
        name: data.name,
        slug: data.slug,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
      });

      // Update admin credentials if changed
      const adminEmailChanged = adminInfo && data.adminEmail && data.adminEmail !== adminInfo.email;
      const adminPasswordChanged = data.adminPassword && data.adminPassword.length >= 6;

      if (adminInfo && (adminEmailChanged || adminPasswordChanged)) {
        const credBody: Record<string, unknown> = {
          user_id: adminInfo.userId,
          school_id: school.id,
          role: 'school_admin',
        };
        if (adminEmailChanged) credBody.new_email = data.adminEmail;
        if (adminPasswordChanged) credBody.new_password = data.adminPassword;

        try {
          const result = await api.post<{ error?: string }>('/users/update-credentials', credBody);

          if (result?.error) {
            toast.warning('School updated, but failed to update admin credentials: ' + result.error);
          } else {
            toast.success('School and admin credentials updated successfully!');
            onOpenChange(false);
            onSuccess?.();
            return;
          }
        } catch (credErr: any) {
          toast.warning('School updated, but failed to update admin credentials: ' + credErr.message);
        }
      }

      toast.success('School updated successfully!');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to update school.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Edit School</DialogTitle>
              <DialogDescription>Update school information and admin credentials</DialogDescription>
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
                    <Input placeholder="Enter school name" {...field} />
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
                    <Textarea placeholder="Enter school address" className="resize-none" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <KeyRound className="h-4 w-4" />
              School Admin Credentials
            </div>

            {loadingAdmin ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading admin info...
              </div>
            ) : adminInfo ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Admin: <span className="font-medium text-foreground">{adminInfo.fullName || 'Unnamed'}</span>
                </p>

                <FormField
                  control={form.control}
                  name="adminEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@school.edu" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Change the admin's login email address.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="adminPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reset Admin Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Leave blank to keep current" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Enter a new password to reset. Min 6 characters.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-2">
                No admin account found for this school.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
