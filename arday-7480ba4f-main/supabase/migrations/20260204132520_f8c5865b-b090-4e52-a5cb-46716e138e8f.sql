-- Create invoice templates table for storing school-specific invoice layouts
CREATE TABLE public.invoice_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Template',
  is_default BOOLEAN NOT NULL DEFAULT false,
  layout JSONB NOT NULL DEFAULT '{"blocks": [], "styles": {}}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_id, is_default) -- Only one default template per school when is_default is true
);

-- Create a partial unique index to ensure only one default template per school
DROP INDEX IF EXISTS idx_invoice_templates_default;
CREATE UNIQUE INDEX idx_invoice_templates_single_default 
ON public.invoice_templates (school_id) 
WHERE is_default = true;

-- Enable RLS
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "Super admins can manage all invoice templates"
ON public.invoice_templates
FOR ALL
USING (public.is_super_admin(auth.uid()));

-- School admins can manage their school's templates
CREATE POLICY "School admins can view their templates"
ON public.invoice_templates
FOR SELECT
USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "School admins can create templates"
ON public.invoice_templates
FOR INSERT
WITH CHECK (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "School admins can update their templates"
ON public.invoice_templates
FOR UPDATE
USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "School admins can delete their templates"
ON public.invoice_templates
FOR DELETE
USING (public.is_school_admin(auth.uid(), school_id));

-- Add trigger for updated_at
CREATE TRIGGER update_invoice_templates_updated_at
BEFORE UPDATE ON public.invoice_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_invoice_templates_school_id ON public.invoice_templates(school_id);