
-- Add month/year tracking columns to invoice_counters
ALTER TABLE public.invoice_counters 
  ADD COLUMN IF NOT EXISTS current_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  ADD COLUMN IF NOT EXISTS current_month integer NOT NULL DEFAULT EXTRACT(MONTH FROM now())::integer;

-- Drop the unique constraint on school_id if it exists (it's a PK)
-- and recreate with the new logic

-- Update the trigger function to use INV-YYYY-MM-XX format with monthly reset
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

  -- Try to insert or update the counter
  INSERT INTO public.invoice_counters (school_id, next_number, current_year, current_month)
  VALUES (NEW.school_id, 2, _year, _month)
  ON CONFLICT (school_id)
  DO UPDATE SET
    next_number = CASE
      WHEN invoice_counters.current_year = _year AND invoice_counters.current_month = _month
        THEN invoice_counters.next_number + 1
      ELSE 2  -- reset to 2 (we return next_number - 1, so first invoice = 1)
    END,
    current_year = _year,
    current_month = _month
  RETURNING next_number - 1, current_year, current_month INTO _next, _current_year, _current_month;

  -- Format as INV-YYYY-MM-XX
  NEW.invoice_number := 'INV-' || _current_year::text || '-' || lpad(_current_month::text, 2, '0') || '-' || lpad(_next::text, 2, '0');

  RETURN NEW;
END;
$function$;
