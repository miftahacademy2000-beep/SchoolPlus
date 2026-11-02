-- Create attendance table
CREATE TABLE public.attendance (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    notes TEXT,
    marked_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(student_id, class_id, date)
);

-- Create grades table
CREATE TABLE public.grades (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    grade_type TEXT NOT NULL CHECK (grade_type IN ('assignment', 'quiz', 'exam', 'project', 'participation')),
    title TEXT NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
    weight NUMERIC(3,2) DEFAULT 1.0,
    graded_by UUID REFERENCES public.profiles(id),
    graded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create timetable_slots table
CREATE TABLE public.timetable_slots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create parents table (for parent profiles linked to users)
CREATE TABLE public.parents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    phone TEXT,
    address TEXT,
    occupation TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- Attendance RLS Policies
CREATE POLICY "Super admins can manage all attendance"
ON public.attendance FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage attendance in their school"
ON public.attendance FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = attendance.student_id
        AND is_school_admin(auth.uid(), s.school_id)
    )
);

CREATE POLICY "Teachers can manage attendance in their school"
ON public.attendance FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = attendance.student_id
        AND is_teacher_in_school(auth.uid(), s.school_id)
    )
);

CREATE POLICY "Students can view their own attendance"
ON public.attendance FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = attendance.student_id
        AND s.user_id = auth.uid()
    )
);

CREATE POLICY "Parents can view their children's attendance"
ON public.attendance FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.parent_students ps
        JOIN public.students s ON s.id = ps.student_id
        WHERE s.id = attendance.student_id
        AND ps.parent_id = auth.uid()
    )
);

-- Grades RLS Policies
CREATE POLICY "Super admins can manage all grades"
ON public.grades FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage grades in their school"
ON public.grades FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = grades.student_id
        AND is_school_admin(auth.uid(), s.school_id)
    )
);

CREATE POLICY "Teachers can manage grades in their school"
ON public.grades FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = grades.student_id
        AND is_teacher_in_school(auth.uid(), s.school_id)
    )
);

CREATE POLICY "Students can view their own grades"
ON public.grades FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.students s
        WHERE s.id = grades.student_id
        AND s.user_id = auth.uid()
    )
);

CREATE POLICY "Parents can view their children's grades"
ON public.grades FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.parent_students ps
        JOIN public.students s ON s.id = ps.student_id
        WHERE s.id = grades.student_id
        AND ps.parent_id = auth.uid()
    )
);

-- Timetable RLS Policies
CREATE POLICY "Super admins can manage all timetables"
ON public.timetable_slots FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage timetables in their school"
ON public.timetable_slots FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = timetable_slots.class_id
        AND is_school_admin(auth.uid(), c.school_id)
    )
);

CREATE POLICY "Teachers can view timetables in their school"
ON public.timetable_slots FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = timetable_slots.class_id
        AND is_teacher_in_school(auth.uid(), c.school_id)
    )
);

CREATE POLICY "Students can view timetables in their school"
ON public.timetable_slots FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = timetable_slots.class_id
        AND is_student_in_school(auth.uid(), c.school_id)
    )
);

-- Parents RLS Policies
CREATE POLICY "Super admins can manage all parents"
ON public.parents FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage parents in their school"
ON public.parents FOR ALL
USING (is_school_admin(auth.uid(), school_id));

CREATE POLICY "Parents can view themselves"
ON public.parents FOR SELECT
USING (user_id = auth.uid());

-- Add updated_at triggers
CREATE TRIGGER update_attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grades_updated_at
BEFORE UPDATE ON public.grades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_timetable_slots_updated_at
BEFORE UPDATE ON public.timetable_slots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parents_updated_at
BEFORE UPDATE ON public.parents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_attendance_student_date ON public.attendance(student_id, date);
CREATE INDEX idx_attendance_class_date ON public.attendance(class_id, date);
CREATE INDEX idx_grades_student ON public.grades(student_id);
CREATE INDEX idx_grades_course ON public.grades(course_id);
CREATE INDEX idx_timetable_class ON public.timetable_slots(class_id);
CREATE INDEX idx_timetable_day ON public.timetable_slots(day_of_week);
CREATE INDEX idx_parents_school ON public.parents(school_id);