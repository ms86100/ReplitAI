-- Function to look up a user id by email bypassing RLS
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;