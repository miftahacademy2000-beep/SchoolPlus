-- Platform-wide settings table for Super Admin configuration
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can read and manage platform settings
CREATE POLICY "Super admins can manage platform settings"
  ON public.platform_settings FOR ALL
  USING (is_super_admin(auth.uid()));

-- Seed default platform settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('general', '{"platform_name": "EduFlow", "support_email": "", "default_language": "en", "timezone": "UTC", "maintenance_mode": false}'::jsonb, 'General platform configuration'),
  ('security', '{"min_password_length": 6, "max_login_attempts": 5, "lockout_duration_minutes": 15, "require_email_verification": true, "session_timeout_hours": 24}'::jsonb, 'Security and authentication settings'),
  ('notifications', '{"enable_email_notifications": true, "enable_system_alerts": true, "digest_frequency": "daily", "admin_alert_on_new_school": true, "admin_alert_on_new_user": true}'::jsonb, 'Notification configuration'),
  ('defaults', '{"default_school_plan": "free", "default_class_capacity": 30, "default_course_credits": 3, "auto_archive_inactive_days": 0, "allow_self_registration": false}'::jsonb, 'Default values for new entities');