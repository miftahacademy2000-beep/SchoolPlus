-- Add RLS policy for students to view their own class enrollments
CREATE POLICY "Students can view their own enrollments"
  ON public.class_students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = class_students.student_id
      AND s.user_id = auth.uid()
    )
  );