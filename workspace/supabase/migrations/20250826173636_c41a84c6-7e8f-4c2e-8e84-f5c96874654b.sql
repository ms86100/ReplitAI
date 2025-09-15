-- Ensure the signup trigger exists to automatically create profile and assign roles
-- 1) Create/replace the trigger on auth.users to call public.handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 2) Backfill: if admin@admin.com already exists, ensure profile and admin role are present
DO $$
DECLARE
  admin_user_id uuid;
  admin_full_name text;
BEGIN
  SELECT id, COALESCE(raw_user_meta_data->>'full_name', 'Admin')
    INTO admin_user_id, admin_full_name
  FROM auth.users
  WHERE email = 'admin@admin.com'
  LIMIT 1;

  IF admin_user_id IS NOT NULL THEN
    -- Ensure profile exists
    INSERT INTO public.profiles (id, email, full_name)
    SELECT admin_user_id, 'admin@admin.com', admin_full_name
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = admin_user_id
    );

    -- Ensure admin role exists
    INSERT INTO public.user_roles (user_id, role)
    SELECT admin_user_id, 'admin'::public.app_role
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.user_id = admin_user_id AND ur.role = 'admin'::public.app_role
    );
  END IF;
END $$;