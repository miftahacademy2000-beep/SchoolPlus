
-- Create subscription payments table
CREATE TABLE public.subscription_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  amount NUMERIC NOT NULL DEFAULT 0,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_date TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage subscription payments
CREATE POLICY "Super admins can manage all subscription payments"
  ON public.subscription_payments FOR ALL
  USING (is_super_admin(auth.uid()));

-- School admins can view their own payments
CREATE POLICY "School admins can view their school payments"
  ON public.subscription_payments FOR SELECT
  USING (is_school_admin(auth.uid(), school_id));

-- Trigger for updated_at
CREATE TRIGGER update_subscription_payments_updated_at
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add unique constraint on invoice_number
ALTER TABLE public.subscription_payments ADD CONSTRAINT subscription_payments_invoice_number_key UNIQUE (invoice_number);
