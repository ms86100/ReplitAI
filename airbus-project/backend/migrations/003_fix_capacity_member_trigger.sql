-- Fix incorrect triggers on team_capacity_members causing NEW.working_days errors
-- This migration safely removes any problematic triggers and adds a correct one

-- 1) Drop unknown/broken triggers on public.team_capacity_members except known safe ones
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'team_capacity_members'
      AND NOT t.tgisinternal
      AND tgname NOT IN (
        'update_team_capacity_members_updated_at',
        'trg_team_capacity_members_set_department',
        'trg_team_capacity_members_calc_capacity' -- our new trigger below
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.team_capacity_members;', rec.tgname);
  END LOOP;
END $$;

-- 2) Create (or replace) a safe trigger function that computes effective capacity
CREATE OR REPLACE FUNCTION public.trg_team_capacity_members_compute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _working_days integer := 0;
BEGIN
  -- Fetch working days from the parent iteration
  SELECT working_days INTO _working_days
  FROM public.team_capacity_iterations
  WHERE id = NEW.iteration_id;

  IF _working_days IS NULL THEN
    _working_days := 0;
  END IF;

  -- Compute effective capacity using existing helper
  NEW.effective_capacity_days := public.calculate_effective_capacity(
    COALESCE(_working_days, 0),
    COALESCE(NEW.leaves, 0),
    COALESCE(NEW.availability_percent, 100),
    COALESCE(NEW.work_mode, 'office')
  );

  RETURN NEW;
END;
$$;

-- 3) Ensure our trigger exists and is attached correctly
DROP TRIGGER IF EXISTS trg_team_capacity_members_calc_capacity ON public.team_capacity_members;
CREATE TRIGGER trg_team_capacity_members_calc_capacity
BEFORE INSERT OR UPDATE ON public.team_capacity_members
FOR EACH ROW EXECUTE FUNCTION public.trg_team_capacity_members_compute();
