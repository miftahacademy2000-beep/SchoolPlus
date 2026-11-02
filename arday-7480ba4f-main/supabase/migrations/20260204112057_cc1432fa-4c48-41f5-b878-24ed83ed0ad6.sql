-- Drop existing teacher policies and create more restrictive ones

-- CLASSES: Teachers can only view/manage classes assigned to them
DROP POLICY IF EXISTS "Teachers can manage classes in their school" ON public.classes;

CREATE POLICY "Teachers can view their assigned classes"
ON public.classes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.user_id = auth.uid()
    AND t.id = classes.teacher_id
  )
);

-- COURSES: Teachers can only view/manage courses assigned to them
DROP POLICY IF EXISTS "Teachers can manage courses in their school" ON public.courses;

CREATE POLICY "Teachers can view their assigned courses"
ON public.courses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.user_id = auth.uid()
    AND t.id = courses.teacher_id
  )
);

CREATE POLICY "Teachers can update their assigned courses"
ON public.courses FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.user_id = auth.uid()
    AND t.id = courses.teacher_id
  )
);

-- STUDENTS: Teachers can only view students in their assigned classes
DROP POLICY IF EXISTS "Teachers can view students in their school" ON public.students;

CREATE POLICY "Teachers can view students in their classes"
ON public.students FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM class_students cs
    JOIN classes c ON c.id = cs.class_id
    JOIN teachers t ON t.id = c.teacher_id
    WHERE cs.student_id = students.id
    AND t.user_id = auth.uid()
  )
);

-- ATTENDANCE: Teachers can only manage attendance for their own classes
DROP POLICY IF EXISTS "Teachers can manage attendance in their school" ON public.attendance;

CREATE POLICY "Teachers can take attendance for their classes"
ON public.attendance FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM classes c
    JOIN teachers t ON t.id = c.teacher_id
    WHERE c.id = attendance.class_id
    AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can view attendance for their classes"
ON public.attendance FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM classes c
    JOIN teachers t ON t.id = c.teacher_id
    WHERE c.id = attendance.class_id
    AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can edit same-day attendance for their classes"
ON public.attendance FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM classes c
    JOIN teachers t ON t.id = c.teacher_id
    WHERE c.id = attendance.class_id
    AND t.user_id = auth.uid()
  )
  AND attendance.date = CURRENT_DATE
);

CREATE POLICY "Teachers can delete same-day attendance for their classes"
ON public.attendance FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM classes c
    JOIN teachers t ON t.id = c.teacher_id
    WHERE c.id = attendance.class_id
    AND t.user_id = auth.uid()
  )
  AND attendance.date = CURRENT_DATE
);

-- GRADES: Teachers can only manage grades for their assigned courses
DROP POLICY IF EXISTS "Teachers can manage grades in their school" ON public.grades;

CREATE POLICY "Teachers can enter grades for their courses"
ON public.grades FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM courses c
    JOIN teachers t ON t.id = c.teacher_id
    WHERE c.id = grades.course_id
    AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can view grades for their courses"
ON public.grades FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM courses c
    JOIN teachers t ON t.id = c.teacher_id
    WHERE c.id = grades.course_id
    AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Teachers can update grades for their courses"
ON public.grades FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM courses c
    JOIN teachers t ON t.id = c.teacher_id
    WHERE c.id = grades.course_id
    AND t.user_id = auth.uid()
  )
);

-- TIMETABLE: Teachers can only view timetable slots for their classes
DROP POLICY IF EXISTS "Teachers can view timetables in their school" ON public.timetable_slots;

CREATE POLICY "Teachers can view their timetable slots"
ON public.timetable_slots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.user_id = auth.uid()
    AND (
      t.id = timetable_slots.teacher_id
      OR EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = timetable_slots.class_id
        AND c.teacher_id = t.id
      )
    )
  )
);

-- CLASS_STUDENTS: Teachers can view enrollments for their classes only
DROP POLICY IF EXISTS "Teachers can view class enrollments" ON public.class_students;

CREATE POLICY "Teachers can view enrollments in their classes"
ON public.class_students FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM classes c
    JOIN teachers t ON t.id = c.teacher_id
    WHERE c.id = class_students.class_id
    AND t.user_id = auth.uid()
  )
);

-- PROFILES: Ensure teachers can view and edit their own profile
-- (Already exists: Users can update their own profile)
-- Add policy for teachers to view student/parent profiles they need
CREATE POLICY "Teachers can view profiles of students in their classes"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM students s
    JOIN class_students cs ON cs.student_id = s.id
    JOIN classes c ON c.id = cs.class_id
    JOIN teachers t ON t.id = c.teacher_id
    WHERE s.user_id = profiles.id
    AND t.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM parents p
    JOIN parent_students ps ON ps.parent_id = p.user_id
    JOIN students s ON s.id = ps.student_id
    JOIN class_students cs ON cs.student_id = s.id
    JOIN classes c ON c.id = cs.class_id
    JOIN teachers t ON t.id = c.teacher_id
    WHERE p.user_id = profiles.id
    AND t.user_id = auth.uid()
  )
);