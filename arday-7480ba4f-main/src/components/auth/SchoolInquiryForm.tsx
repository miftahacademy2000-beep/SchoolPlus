import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { School, User, Mail, Phone, MapPin, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { schoolInquirySchema, SchoolInquiryFormData } from '@/lib/validations/schoolInquiry';
import { useSchoolInquiries } from '@/hooks/useSchoolInquiries';

interface SchoolInquiryFormProps {
  onSuccess?: () => void;
}

export function SchoolInquiryForm({ onSuccess }: SchoolInquiryFormProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { submitInquiry } = useSchoolInquiries();

  const form = useForm<SchoolInquiryFormData>({
    resolver: zodResolver(schoolInquirySchema),
    defaultValues: {
      school_name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      message: '',
    },
  });

  const handleSubmit = async (data: SchoolInquiryFormData) => {
    await submitInquiry.mutateAsync({
      school_name: data.school_name,
      contact_name: data.contact_name,
      email: data.email,
      phone: data.phone || undefined,
      address: data.address || undefined,
      message: data.message || undefined,
    });
    setIsSubmitted(true);
    onSuccess?.();
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-8 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Thank You!</h3>
        <p className="text-muted-foreground mt-2 max-w-sm">
          Your inquiry has been submitted successfully. Our team will review your request and contact you soon.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setIsSubmitted(false);
            form.reset();
          }}
        >
          Submit Another Inquiry
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="school_name">School Name *</Label>
          <div className="relative">
            <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="school_name"
              placeholder="Enter school name"
              className={cn(
                "pl-10",
                form.formState.errors.school_name && "border-destructive"
              )}
              {...form.register('school_name')}
            />
          </div>
          {form.formState.errors.school_name && (
            <p className="text-sm text-destructive">
              {form.formState.errors.school_name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact_name">Contact Person *</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="contact_name"
              placeholder="Your full name"
              className={cn(
                "pl-10",
                form.formState.errors.contact_name && "border-destructive"
              )}
              {...form.register('contact_name')}
            />
          </div>
          {form.formState.errors.contact_name && (
            <p className="text-sm text-destructive">
              {form.formState.errors.contact_name.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address *</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="contact@school.edu"
              className={cn(
                "pl-10",
                form.formState.errors.email && "border-destructive"
              )}
              {...form.register('email')}
            />
          </div>
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="phone"
              placeholder="+1 (555) 000-0000"
              className="pl-10"
              {...form.register('phone')}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">School Address</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="address"
            placeholder="123 Education St, City, State, ZIP"
            className="pl-10"
            {...form.register('address')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Additional Information</Label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Textarea
            id="message"
            placeholder="Tell us about your school and what you're looking for..."
            className="pl-10 min-h-[100px] resize-none"
            {...form.register('message')}
          />
        </div>
        {form.formState.errors.message && (
          <p className="text-sm text-destructive">
            {form.formState.errors.message.message}
          </p>
        )}
      </div>

      <Button 
        type="submit" 
        className="w-full" 
        disabled={submitInquiry.isPending}
      >
        {submitInquiry.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          'Submit Inquiry'
        )}
      </Button>
    </form>
  );
}
