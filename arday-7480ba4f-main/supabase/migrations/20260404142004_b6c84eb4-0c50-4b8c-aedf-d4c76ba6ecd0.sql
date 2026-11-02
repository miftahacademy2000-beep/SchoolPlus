
-- Update the assign_invoice_number function to use 3-digit sequence
CREATE OR REPLACE FUNCTION public.assign_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _next integer;
  _year integer;
  _month integer;
  _current_year integer;
  _current_month integer;
BEGIN
  _year := EXTRACT(YEAR FROM now())::integer;
  _month := EXTRACT(MONTH FROM now())::integer;

  INSERT INTO public.invoice_counters (school_id, next_number, current_year, current_month)
  VALUES (NEW.school_id, 2, _year, _month)
  ON CONFLICT (school_id)
  DO UPDATE SET
    next_number = CASE
      WHEN invoice_counters.current_year = _year AND invoice_counters.current_month = _month
        THEN invoice_counters.next_number + 1
      ELSE 2
    END,
    current_year = _year,
    current_month = _month
  RETURNING next_number - 1, current_year, current_month INTO _next, _current_year, _current_month;

  -- Format as INV-YYYY-MM-XXX (3-digit sequence)
  NEW.invoice_number := 'INV-' || _current_year::text || '-' || lpad(_current_month::text, 2, '0') || '-' || lpad(_next::text, 3, '0');

  RETURN NEW;
END;
$function$;

-- Backfill existing invoices to 3-digit format
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
    ORDER BY school_id, created_at ASC
  LOOP
    IF current_school IS DISTINCT FROM r.school_id THEN
      current_school := r.school_id;
      seq := 0;
    END IF;
    seq := seq + 1;
    
    UPDATE public.invoices 
    SET invoice_number = 'INV-' || EXTRACT(YEAR FROM created_at)::integer::text || '-' || lpad(EXTRACT(MONTH FROM created_at)::integer::text, 2, '0') || '-' || lpad(seq::text, 3, '0')
    WHERE id = r.id;
  END LOOP;
  
  -- Update counters to reflect current state
  UPDATE public.invoice_counters ic
  SET next_number = COALESCE((
    SELECT COUNT(*) + 1 
    FROM public.invoices i 
    WHERE i.school_id = ic.school_id 
      AND EXTRACT(YEAR FROM i.created_at) = ic.current_year 
      AND EXTRACT(MONTH FROM i.created_at) = ic.current_month
  ), 1);
END $$;
