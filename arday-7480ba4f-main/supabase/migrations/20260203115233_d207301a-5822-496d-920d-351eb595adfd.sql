-- Create invoices table for school fees
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all invoices
CREATE POLICY "Super admins can manage all invoices"
  ON public.invoices FOR ALL
  USING (is_super_admin(auth.uid()));

-- School admins can manage invoices in their school
CREATE POLICY "School admins can manage invoices in their school"
  ON public.invoices FOR ALL
  USING (is_school_admin(auth.uid(), school_id));

-- Parents can view their children's invoices
CREATE POLICY "Parents can view their children's invoices"
  ON public.invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM parent_students ps
    WHERE ps.student_id = invoices.student_id
    AND ps.parent_id = auth.uid()
  ));

-- Students can view their own invoices
CREATE POLICY "Students can view their own invoices"
  ON public.invoices FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = invoices.student_id
    AND s.user_id = auth.uid()
  ));

-- Create updated_at trigger
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_invoices_student_id ON public.invoices(student_id);
CREATE INDEX idx_invoices_school_id ON public.invoices(school_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);