-- Add must_change_password column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email text,
    user_name text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    entity_name text,
    school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON public.audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can view all audit logs
CREATE POLICY "Super admins can view all audit logs"
ON public.audit_logs FOR SELECT
USING (is_super_admin(auth.uid()));

-- School admins can view audit logs for their school
CREATE POLICY "School admins can view their school audit logs"
ON public.audit_logs FOR SELECT
USING (is_school_admin(auth.uid(), school_id));

-- Allow insert from authenticated users (for logging their own actions)
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
    p_action text,
    p_entity_type text,
    p_entity_id uuid DEFAULT NULL,
    p_entity_name text DEFAULT NULL,
    p_school_id uuid DEFAULT NULL,
    p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_user_email text;
    v_user_name text;
    v_log_id uuid;
BEGIN
    -- Get current user info
    v_user_id := auth.uid();
    
    SELECT email, full_name INTO v_user_email, v_user_name
    FROM profiles WHERE id = v_user_id;
    
    -- Insert audit log
    INSERT INTO audit_logs (
        user_id,
        user_email,
        user_name,
        action,
        entity_type,
        entity_id,
        entity_name,
        school_id,
        details
    ) VALUES (
        v_user_id,
        v_user_email,
        v_user_name,
        p_action,
        p_entity_type,
        p_entity_id,
        p_entity_name,
        p_school_id,
        p_details
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;