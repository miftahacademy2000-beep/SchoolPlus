-- Create status enum for school inquiries
CREATE TYPE public.inquiry_status AS ENUM ('pending', 'approved', 'rejected');

-- Create school inquiries table
CREATE TABLE public.school_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  message TEXT,
  status inquiry_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.school_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit an inquiry (public form)
CREATE POLICY "Anyone can submit school inquiry"
ON public.school_inquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only super admins can view inquiries
CREATE POLICY "Super admins can view all inquiries"
ON public.school_inquiries
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Only super admins can update inquiries
CREATE POLICY "Super admins can update inquiries"
ON public.school_inquiries
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Only super admins can delete inquiries
CREATE POLICY "Super admins can delete inquiries"
ON public.school_inquiries
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_school_inquiries_updated_at
BEFORE UPDATE ON public.school_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();