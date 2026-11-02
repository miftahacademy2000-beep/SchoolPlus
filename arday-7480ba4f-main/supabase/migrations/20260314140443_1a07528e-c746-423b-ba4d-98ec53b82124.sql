
-- Table to track the next invoice number per school (branch)
CREATE TABLE public.invoice_counters (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  next_number integer NOT NULL DEFAULT 1
);

-- Enable RLS
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Super admins can manage invoice counters"
ON public.invoice_counters FOR ALL TO public
USING (is_super_admin(auth.uid()));

CREATE POLICY "School admins can view their counter"
ON public.invoice_counters FOR SELECT TO public
USING (is_school_admin(auth.uid(), school_id));

-- Function to get and increment next invoice number for a school
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(_school_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next integer;
BEGIN
  -- Insert counter row if not exists, or get and increment
  INSERT INTO public.invoice_counters (school_id, next_number)
  VALUES (_school_id, 2)
  ON CONFLICT (school_id)
  DO UPDATE SET next_number = invoice_counters.next_number + 1
  RETURNING next_number - 1 INTO _next;

  -- Return formatted number (no leading zeros for long formats, just the number with minimal padding)
  IF _next < 10 THEN
    RETURN lpad(_next::text, 2, '0');
  ELSE
    RETURN _next::text;
  END IF;
END;
$$;

-- Initialize counters for existing schools based on their current max invoice count
INSERT INTO public.invoice_counters (school_id, next_number)
SELECT s.id, COALESCE(
  (SELECT COUNT(*) + 1 FROM public.invoices i WHERE i.school_id = s.id),
  1
)
FROM public.schools s
ON CONFLICT (school_id) DO NOTHING;
