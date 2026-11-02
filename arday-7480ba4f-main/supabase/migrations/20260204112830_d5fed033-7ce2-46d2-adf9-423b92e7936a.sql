-- Create learning_materials table
CREATE TABLE public.learning_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;

-- Teachers can view materials for their courses
CREATE POLICY "Teachers can view their course materials"
ON public.learning_materials FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = learning_materials.teacher_id
    AND t.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM courses c
    JOIN teachers t ON t.id = c.teacher_id
    WHERE c.id = learning_materials.course_id
    AND t.user_id = auth.uid()
  )
);

-- Teachers can insert materials for their courses
CREATE POLICY "Teachers can upload materials for their courses"
ON public.learning_materials FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teachers t
    JOIN courses c ON c.teacher_id = t.id
    WHERE t.user_id = auth.uid()
    AND c.id = course_id
  )
);

-- Teachers can update their own materials
CREATE POLICY "Teachers can update their own materials"
ON public.learning_materials FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = learning_materials.teacher_id
    AND t.user_id = auth.uid()
  )
);

-- Teachers can delete their own materials
CREATE POLICY "Teachers can delete their own materials"
ON public.learning_materials FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = learning_materials.teacher_id
    AND t.user_id = auth.uid()
  )
);

-- Students can view materials for courses they're enrolled in
CREATE POLICY "Students can view materials for enrolled courses"
ON public.learning_materials FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM students s
    JOIN class_students cs ON cs.student_id = s.id
    JOIN classes cl ON cl.id = cs.class_id
    JOIN courses c ON c.school_id = cl.school_id
    WHERE s.user_id = auth.uid()
    AND c.id = learning_materials.course_id
  )
);

-- School admins can view all materials in their school
CREATE POLICY "School admins can view school materials"
ON public.learning_materials FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM courses c
    JOIN user_roles ur ON ur.school_id = c.school_id
    WHERE c.id = learning_materials.course_id
    AND ur.user_id = auth.uid()
    AND ur.role = 'school_admin'
  )
);

-- Super admins can view all materials
CREATE POLICY "Super admins can view all materials"
ON public.learning_materials FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Create storage bucket for learning materials
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('learning-materials', 'learning-materials', false, 52428800);

-- Storage policies for learning materials bucket
CREATE POLICY "Teachers can upload learning materials"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'learning-materials'
  AND EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can view their materials"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'learning-materials'
  AND EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can delete their materials"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'learning-materials'
  AND EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.user_id = auth.uid()
  )
);

CREATE POLICY "Students can download course materials"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'learning-materials'
  AND EXISTS (
    SELECT 1 FROM students s
    WHERE s.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_learning_materials_updated_at
BEFORE UPDATE ON public.learning_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();