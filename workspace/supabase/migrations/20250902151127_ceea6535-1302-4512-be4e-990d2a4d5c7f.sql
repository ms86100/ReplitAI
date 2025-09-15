-- Create function to set auth context for triggers using auth.uid()
create or replace function public.set_current_user_id(_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  -- Emulate PostgREST auth context so auth.uid() works in triggers
  perform set_config('request.jwt.claim.sub', _user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
$$;