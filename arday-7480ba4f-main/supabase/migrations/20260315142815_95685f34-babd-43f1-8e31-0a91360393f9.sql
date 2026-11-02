
-- Create payment_history table to track individual partial payments
CREATE TABLE public.payment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- RLS policies (mirror invoice policies)
CREATE POLICY "Super admins can manage all payment history"
  ON public.payment_history FOR ALL TO public
  USING (is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage payment history in their school"
  ON public.payment_history FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = payment_history.invoice_id
    AND is_school_admin(auth.uid(), i.school_id)
  ));

CREATE POLICY "Students can view their own payment history"
  ON public.payment_history FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.students s ON s.id = i.student_id
    WHERE i.id = payment_history.invoice_id
    AND s.user_id = auth.uid()
  ));

CREATE POLICY "Parents can view their children payment history"
  ON public.payment_history FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.parent_students ps ON ps.student_id = i.student_id
    WHERE i.id = payment_history.invoice_id
    AND ps.parent_id = auth.uid()
  ));
