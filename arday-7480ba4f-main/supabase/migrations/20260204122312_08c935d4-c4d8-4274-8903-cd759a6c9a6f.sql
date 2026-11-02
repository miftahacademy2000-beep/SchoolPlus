-- First, drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.class_students;

-- Create a security definer function to check if user is the student
CREATE OR REPLACE FUNCTION public.is_student_owner(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE id = _student_id
    AND user_id = _user_id
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Students can view their own enrollments"
  ON public.class_students
  FOR SELECT
  USING (public.is_student_owner(auth.uid(), student_id));