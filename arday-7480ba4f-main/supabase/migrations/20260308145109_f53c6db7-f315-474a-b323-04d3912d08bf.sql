
-- Create archived_users table to store soft-deleted users
CREATE TABLE public.archived_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id uuid NOT NULL,
  user_id uuid NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  user_type text NOT NULL, -- 'student', 'teacher', 'parent'
  full_name text,
  email text,
  phone text,
  avatar_url text,
  -- Role-specific data stored as JSONB
  metadata jsonb DEFAULT '{}'::jsonb,
  archived_by uuid,
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  reason text
);

-- Enable RLS
ALTER TABLE public.archived_users ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all archived users
CREATE POLICY "Super admins can manage all archived users"
  ON public.archived_users FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- School admins can manage archived users in their school
CREATE POLICY "School admins can manage archived users in their school"
  ON public.archived_users FOR ALL
  TO authenticated
  USING (is_school_admin(auth.uid(), school_id));

-- Create index for faster lookups
CREATE INDEX idx_archived_users_school_id ON public.archived_users(school_id);
CREATE INDEX idx_archived_users_user_type ON public.archived_users(user_type);
