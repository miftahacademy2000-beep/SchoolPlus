-- Create assignments table
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  max_score NUMERIC NOT NULL DEFAULT 100,
  assignment_type TEXT NOT NULL DEFAULT 'homework',
  status TEXT NOT NULL DEFAULT 'draft',
  attachments TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create assignment submissions table
CREATE TABLE public.assignment_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  submission_text TEXT,
  attachments TEXT[],
  score NUMERIC,
  feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  graded_at TIMESTAMP WITH TIME ZONE,
  graded_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignments
CREATE POLICY "Super admins can manage all assignments"
ON public.assignments FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage assignments in their school"
ON public.assignments FOR ALL
USING (EXISTS (
  SELECT 1 FROM courses c
  WHERE c.id = assignments.course_id
  AND is_school_admin(auth.uid(), c.school_id)
));

CREATE POLICY "Teachers can manage their own assignments"
ON public.assignments FOR ALL
USING (EXISTS (
  SELECT 1 FROM teachers t
  WHERE t.id = assignments.teacher_id
  AND t.user_id = auth.uid()
));

CREATE POLICY "Teachers can view assignments in their school"
ON public.assignments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM courses c
  WHERE c.id = assignments.course_id
  AND is_teacher_in_school(auth.uid(), c.school_id)
));

CREATE POLICY "Students can view published assignments for their courses"
ON public.assignments FOR SELECT
USING (
  status = 'published' AND
  EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = assignments.course_id
    AND is_student_in_school(auth.uid(), c.school_id)
  )
);

-- RLS Policies for assignment submissions
CREATE POLICY "Super admins can manage all submissions"
ON public.assignment_submissions FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage submissions in their school"
ON public.assignment_submissions FOR ALL
USING (EXISTS (
  SELECT 1 FROM assignments a
  JOIN courses c ON c.id = a.course_id
  WHERE a.id = assignment_submissions.assignment_id
  AND is_school_admin(auth.uid(), c.school_id)
));

CREATE POLICY "Teachers can manage submissions for their assignments"
ON public.assignment_submissions FOR ALL
USING (EXISTS (
  SELECT 1 FROM assignments a
  JOIN teachers t ON t.id = a.teacher_id
  WHERE a.id = assignment_submissions.assignment_id
  AND t.user_id = auth.uid()
));

CREATE POLICY "Students can view and update their own submissions"
ON public.assignment_submissions FOR ALL
USING (EXISTS (
  SELECT 1 FROM students s
  WHERE s.id = assignment_submissions.student_id
  AND s.user_id = auth.uid()
));

-- Create triggers for updated_at
CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assignment_submissions_updated_at
BEFORE UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();