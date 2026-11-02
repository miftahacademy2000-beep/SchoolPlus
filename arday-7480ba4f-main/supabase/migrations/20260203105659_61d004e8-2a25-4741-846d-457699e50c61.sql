-- Drop existing FK constraints that point to auth.users and recreate pointing to profiles

-- Students
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_user_id_fkey;
ALTER TABLE public.students
ADD CONSTRAINT students_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Teachers
ALTER TABLE public.teachers DROP CONSTRAINT IF EXISTS teachers_user_id_fkey;
ALTER TABLE public.teachers
ADD CONSTRAINT teachers_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Parents
ALTER TABLE public.parents DROP CONSTRAINT IF EXISTS parents_user_id_fkey;
ALTER TABLE public.parents
ADD CONSTRAINT parents_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;