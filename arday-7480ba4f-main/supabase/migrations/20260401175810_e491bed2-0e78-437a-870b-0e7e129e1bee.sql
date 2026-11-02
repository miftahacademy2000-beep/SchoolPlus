
-- Add monthly_fee column to classes table for per-class fee overrides
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS monthly_fee numeric DEFAULT NULL;

-- Create student_fee_overrides table for per-student fee customization
CREATE TABLE public.student_fee_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
  monthly_fee numeric NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, school_id)
);

-- Enable RLS
ALTER TABLE public.student_fee_overrides ENABLE ROW LEVEL SECURITY;

-- RLS: School admins and super admins can manage fee overrides
CREATE POLICY "School admins can manage fee overrides"
  ON public.student_fee_overrides
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR
    public.is_school_admin(school_id, auth.uid())
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.is_school_admin(school_id, auth.uid())
  );
