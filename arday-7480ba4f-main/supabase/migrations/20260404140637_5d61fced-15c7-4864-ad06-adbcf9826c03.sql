
-- Create the trigger to auto-assign invoice numbers on insert
CREATE OR REPLACE TRIGGER trg_assign_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_invoice_number();

-- Update existing April 2026 invoices to the new format
-- First reset the counters for each school, then update sequentially
DO $$
DECLARE
  r RECORD;
  seq INTEGER;
  current_school UUID := NULL;
BEGIN
  seq := 0;
  FOR r IN 
    SELECT id, school_id 
    FROM public.invoices 
    WHERE created_at >= '2026-04-01' AND created_at < '2026-05-01'
    ORDER BY school_id, created_at ASC
  LOOP
    IF current_school IS DISTINCT FROM r.school_id THEN
      current_school := r.school_id;
      seq := 0;
    END IF;
    seq := seq + 1;
    UPDATE public.invoices 
    SET invoice_number = 'INV-2026-04-' || lpad(seq::text, 2, '0')
    WHERE id = r.id;
    
    -- Update the counter for this school
    INSERT INTO public.invoice_counters (school_id, next_number, current_year, current_month)
    VALUES (r.school_id, seq + 1, 2026, 4)
    ON CONFLICT (school_id) DO UPDATE SET
      next_number = seq + 1,
      current_year = 2026,
      current_month = 4;
  END LOOP;
END $$;
