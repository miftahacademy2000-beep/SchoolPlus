
-- Drop the old function
DROP FUNCTION IF EXISTS public.get_next_invoice_number(uuid);

-- Create a trigger function that auto-assigns invoice numbers on insert
CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next integer;
BEGIN
  -- Get and increment the counter atomically
  INSERT INTO public.invoice_counters (school_id, next_number)
  VALUES (NEW.school_id, 2)
  ON CONFLICT (school_id)
  DO UPDATE SET next_number = invoice_counters.next_number + 1
  RETURNING next_number - 1 INTO _next;

  -- Format the number
  IF _next < 10 THEN
    NEW.invoice_number := lpad(_next::text, 2, '0');
  ELSE
    NEW.invoice_number := _next::text;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on invoices table
CREATE TRIGGER trg_assign_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_invoice_number();
