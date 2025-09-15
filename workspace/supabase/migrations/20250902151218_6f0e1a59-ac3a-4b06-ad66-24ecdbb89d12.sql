-- Fix: create helper to set auth context so auth.uid() works with Node connections
create or replace function public.set_current_user_id(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('request.jwt.claim.sub', _user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;