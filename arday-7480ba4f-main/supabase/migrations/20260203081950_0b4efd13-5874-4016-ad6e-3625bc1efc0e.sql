-- =============================================
-- MULTI-TENANT SCHOOL MANAGEMENT SYSTEM SCHEMA
-- =============================================

-- 1. Create role enum type
CREATE TYPE public.app_role AS ENUM ('super_admin', 'school_admin', 'teacher', 'student', 'parent');

-- 2. Create school status enum
CREATE TYPE public.school_status AS ENUM ('active', 'suspended', 'pending');

-- 3. Create subscription plan enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'pro', 'enterprise');

-- =============================================
-- CORE TABLES
-- =============================================

-- Schools table (tenant table)
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  status public.school_status NOT NULL DEFAULT 'pending',
  plan public.subscription_plan NOT NULL DEFAULT 'free',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table (public user data)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (critical: separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, school_id)
);

-- Memberships table (user-school relationship)
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, school_id)
);

-- Teachers table
CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  employee_id TEXT,
  department TEXT,
  subjects TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, school_id)
);

-- Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  enrollment_number TEXT,
  date_of_birth DATE,
  grade TEXT,
  parent_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, school_id)
);

-- Classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade TEXT,
  section TEXT,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id),
  capacity INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id),
  credits INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code, school_id)
);

-- Class-Student junction table
CREATE TABLE public.class_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);

-- Parent-Student relationship table
CREATE TABLE public.parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'parent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_id, student_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_school_id ON public.user_roles(school_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_school_id ON public.memberships(school_id);
CREATE INDEX idx_teachers_school_id ON public.teachers(school_id);
CREATE INDEX idx_teachers_user_id ON public.teachers(user_id);
CREATE INDEX idx_students_school_id ON public.students(school_id);
CREATE INDEX idx_students_user_id ON public.students(user_id);
CREATE INDEX idx_classes_school_id ON public.classes(school_id);
CREATE INDEX idx_courses_school_id ON public.courses(school_id);
CREATE INDEX idx_schools_status ON public.schools(status);
CREATE INDEX idx_schools_slug ON public.schools(slug);

-- =============================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================

-- Check if user is a super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'super_admin'
    AND school_id IS NULL
  )
$$;

-- Check if user is a school admin for a specific school
CREATE OR REPLACE FUNCTION public.is_school_admin(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'school_admin'
    AND school_id = _school_id
  )
$$;

-- Check if user is a teacher in a specific school
CREATE OR REPLACE FUNCTION public.is_teacher_in_school(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers
    WHERE user_id = _user_id
    AND school_id = _school_id
  )
$$;

-- Check if user is a student in a specific school
CREATE OR REPLACE FUNCTION public.is_student_in_school(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE user_id = _user_id
    AND school_id = _school_id
  )
$$;

-- Check if user is member of a school
CREATE OR REPLACE FUNCTION public.is_member_of_school(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id
    AND school_id = _school_id
    AND is_active = true
  )
$$;

-- Check if user is parent of student
CREATE OR REPLACE FUNCTION public.is_parent_of_student(_parent_id UUID, _student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_students
    WHERE parent_id = _parent_id
    AND student_id = _student_id
  )
$$;

-- Get user's schools
CREATE OR REPLACE FUNCTION public.get_user_schools(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.memberships
  WHERE user_id = _user_id AND is_active = true
$$;

-- =============================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply trigger to all tables
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: SCHOOLS
-- =============================================

CREATE POLICY "Super admins can do everything with schools"
  ON public.schools FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Members can view their schools"
  ON public.schools FOR SELECT
  USING (public.is_member_of_school(auth.uid(), id));

-- =============================================
-- RLS POLICIES: PROFILES
-- =============================================

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- =============================================
-- RLS POLICIES: USER_ROLES
-- =============================================

CREATE POLICY "Roles are viewable by authenticated users"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage roles in their school"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_school_admin(auth.uid(), school_id)
    AND role != 'super_admin'
    AND user_id != auth.uid()
  );

CREATE POLICY "School admins can update roles in their school"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (
    public.is_school_admin(auth.uid(), school_id)
    AND role != 'super_admin'
  );

CREATE POLICY "School admins can delete roles in their school"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (
    public.is_school_admin(auth.uid(), school_id)
    AND role != 'super_admin'
  );

-- =============================================
-- RLS POLICIES: MEMBERSHIPS
-- =============================================

CREATE POLICY "Memberships are viewable by authenticated users"
  ON public.memberships FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage all memberships"
  ON public.memberships FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage memberships in their school"
  ON public.memberships FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_school_admin(auth.uid(), school_id)
    AND user_id != auth.uid()
  );

CREATE POLICY "School admins can update memberships in their school"
  ON public.memberships FOR UPDATE
  TO authenticated
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "School admins can delete memberships in their school"
  ON public.memberships FOR DELETE
  TO authenticated
  USING (public.is_school_admin(auth.uid(), school_id));

-- =============================================
-- RLS POLICIES: TEACHERS
-- =============================================

CREATE POLICY "Super admins can manage all teachers"
  ON public.teachers FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage teachers in their school"
  ON public.teachers FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "Teachers can view teachers in their school"
  ON public.teachers FOR SELECT
  TO authenticated
  USING (public.is_member_of_school(auth.uid(), school_id));

-- =============================================
-- RLS POLICIES: STUDENTS
-- =============================================

CREATE POLICY "Super admins can manage all students"
  ON public.students FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage students in their school"
  ON public.students FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "Teachers can view students in their school"
  ON public.students FOR SELECT
  TO authenticated
  USING (public.is_teacher_in_school(auth.uid(), school_id));

CREATE POLICY "Students can view themselves"
  ON public.students FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Parents can view their children"
  ON public.students FOR SELECT
  TO authenticated
  USING (public.is_parent_of_student(auth.uid(), id));

-- =============================================
-- RLS POLICIES: CLASSES
-- =============================================

CREATE POLICY "Super admins can manage all classes"
  ON public.classes FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage classes in their school"
  ON public.classes FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "Teachers can manage classes in their school"
  ON public.classes FOR ALL
  USING (public.is_teacher_in_school(auth.uid(), school_id));

CREATE POLICY "Students can view classes in their school"
  ON public.classes FOR SELECT
  TO authenticated
  USING (public.is_student_in_school(auth.uid(), school_id));

-- =============================================
-- RLS POLICIES: COURSES
-- =============================================

CREATE POLICY "Super admins can manage all courses"
  ON public.courses FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage courses in their school"
  ON public.courses FOR ALL
  USING (public.is_school_admin(auth.uid(), school_id));

CREATE POLICY "Teachers can manage courses in their school"
  ON public.courses FOR ALL
  USING (public.is_teacher_in_school(auth.uid(), school_id));

CREATE POLICY "Students can view courses in their school"
  ON public.courses FOR SELECT
  TO authenticated
  USING (public.is_student_in_school(auth.uid(), school_id));

-- =============================================
-- RLS POLICIES: CLASS_STUDENTS
-- =============================================

CREATE POLICY "Super admins can manage class enrollments"
  ON public.class_students FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage class enrollments"
  ON public.class_students FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id
      AND public.is_school_admin(auth.uid(), c.school_id)
    )
  );

CREATE POLICY "Teachers can view class enrollments"
  ON public.class_students FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id
      AND public.is_teacher_in_school(auth.uid(), c.school_id)
    )
  );

-- =============================================
-- RLS POLICIES: PARENT_STUDENTS
-- =============================================

CREATE POLICY "Super admins can manage parent-student links"
  ON public.parent_students FOR ALL
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins can manage parent-student links"
  ON public.parent_students FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id
      AND public.is_school_admin(auth.uid(), s.school_id)
    )
  );

CREATE POLICY "Parents can view their own links"
  ON public.parent_students FOR SELECT
  TO authenticated
  USING (parent_id = auth.uid());