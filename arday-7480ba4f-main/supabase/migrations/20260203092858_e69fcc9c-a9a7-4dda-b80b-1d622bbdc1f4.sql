-- Function to assign super_admin role to the first user
CREATE OR REPLACE FUNCTION public.handle_first_user_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  -- Check if there are any super_admins
  SELECT COUNT(*) INTO admin_count
  FROM public.user_roles
  WHERE role = 'super_admin';

  -- If no super_admin exists, make this user a super_admin
  IF admin_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role, school_id)
    VALUES (NEW.id, 'super_admin', NULL);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to run after profile creation (which happens on signup)
CREATE TRIGGER on_profile_created_check_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_first_user_admin();