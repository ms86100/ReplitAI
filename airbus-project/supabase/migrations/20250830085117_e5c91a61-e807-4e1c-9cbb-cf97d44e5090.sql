-- Function to get user email by ID bypassing RLS
CREATE OR REPLACE FUNCTION public.get_user_email_by_id(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- Function to get multiple user emails by IDs bypassing RLS
CREATE OR REPLACE FUNCTION public.get_user_emails_by_ids(_user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profiles.id, profiles.email FROM public.profiles WHERE profiles.id = ANY(_user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_user_email_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_emails_by_ids(uuid[]) TO authenticated;