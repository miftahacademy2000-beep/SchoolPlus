import { useEffect, useRef } from 'react';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useUpdateParent, type ParentWithProfile } from '@/hooks/useParents';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email').max(255).optional().or(z.literal('')),
  phone: z.string().optional(),
  occupation: z.string().optional(),
  address: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface EditParentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent: ParentWithProfile;
}

export function EditParentModal({ open, onOpenChange, parent }: EditParentModalProps) {
  const updateParent = useUpdateParent();
  const contentRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: parent.profile?.full_name || '',
      email: parent.profile?.email || '',
      phone: parent.phone || '',
      occupation: parent.occupation || '',
      address: parent.address || '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        full_name: parent.profile?.full_name || '',
        email: parent.profile?.email || '',
        phone: parent.phone || '',
        occupation: parent.occupation || '',
        address: parent.address || '',
      });
      // Scroll to top when modal opens
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }
  }, [open, parent, form]);

  const onSubmit = async (data: FormData) => {
    await updateParent.mutateAsync({
      id: parent.id,
      user_id: parent.user_id,
      full_name: data.full_name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      occupation: data.occupation || undefined,
      address: data.address || undefined,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={contentRef} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Parent</DialogTitle>
          <DialogDescription>
            Update information for {parent.profile?.full_name || 'this parent'}
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
                    <Input placeholder="Parent name" {...field} />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="parent@example.com" {...field} />
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
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+1 (555) 123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="occupation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupation</FormLabel>
                  <FormControl>
                    <Input placeholder="Engineer" {...field} />
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
                      placeholder="123 Main St, City, State" 
                      className="resize-none" 
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateParent.isPending}>
                {updateParent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
