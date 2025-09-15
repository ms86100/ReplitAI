-- 007_sync_capacity_with_cloud.sql
-- Purpose: Align local DB schema with cloud for Team Capacity
-- - Ensures team_members table exists
-- - Normalizes team_capacity_members structure
-- - Backfills team_members and links team_capacity_members.team_member_id
-- - Adds triggers to auto-calc effective_capacity_days

BEGIN;

-- 1) Ensure team_members table exists (cloud-compatible)
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  skills TEXT[] DEFAULT '{}'::text[],
  work_mode TEXT DEFAULT 'office' CHECK (work_mode IN ('office','wfh','hybrid')),
  default_availability_percent INTEGER DEFAULT 100 CHECK (default_availability_percent >= 0 AND default_availability_percent <= 100),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger for team_members (uses public.update_updated_at_column if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname='update_updated_at_column' AND pg_function_is_visible(oid)
  ) THEN
    DROP TRIGGER IF EXISTS trg_team_members_updated_at ON public.team_members;
    CREATE TRIGGER trg_team_members_updated_at
      BEFORE UPDATE ON public.team_members
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 2) Normalize team_capacity_members to match cloud
-- Add missing columns (no-ops if present)
ALTER TABLE public.team_capacity_members
  ADD COLUMN IF NOT EXISTS member_name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS work_mode TEXT DEFAULT 'office' CHECK (work_mode IN ('office','wfh','hybrid')),
  ADD COLUMN IF NOT EXISTS leaves INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS availability_percent INTEGER DEFAULT 100 CHECK (availability_percent >= 0 AND availability_percent <= 100),
  ADD COLUMN IF NOT EXISTS effective_capacity_days NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS department_id UUID,
  ADD COLUMN IF NOT EXISTS stakeholder_id UUID,
  ADD COLUMN IF NOT EXISTS team_id UUID,
  ADD COLUMN IF NOT EXISTS team_member_id UUID;

-- If older local schema used effective_capacity, rename it to effective_capacity_days
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='team_capacity_members' AND column_name='effective_capacity'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='team_capacity_members' AND column_name='effective_capacity_days'
  ) THEN
    ALTER TABLE public.team_capacity_members RENAME COLUMN effective_capacity TO effective_capacity_days;
  END IF;
END $$;

-- Helpful indexes/constraints
CREATE INDEX IF NOT EXISTS idx_team_capacity_members_iteration_id ON public.team_capacity_members(iteration_id);
CREATE INDEX IF NOT EXISTS idx_team_capacity_members_team_member_id ON public.team_capacity_members(team_member_id);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uniq_tcm_iteration_member'
  ) THEN
    CREATE UNIQUE INDEX uniq_tcm_iteration_member
      ON public.team_capacity_members(iteration_id, team_member_id)
      WHERE team_member_id IS NOT NULL;
  END IF;
END $$;

-- 3) Backfill team_members and link team_capacity_members.team_member_id
WITH need_link AS (
  SELECT DISTINCT
    tcm.team_id, tcm.member_name, tcm.role,
    COALESCE(tcm.work_mode,'office') AS work_mode,
    COALESCE(tcm.availability_percent,100) AS default_availability_percent,
    COALESCE(tcm.created_by, gen_random_uuid()) AS created_by
  FROM public.team_capacity_members tcm
  LEFT JOIN public.team_members tm
    ON tm.team_id = tcm.team_id AND tm.member_name = tcm.member_name
  WHERE tcm.team_member_id IS NULL
    AND tcm.team_id IS NOT NULL
    AND tcm.member_name IS NOT NULL AND btrim(tcm.member_name) <> ''
    AND tm.id IS NULL
), inserted AS (
  INSERT INTO public.team_members (team_id, member_name, role, work_mode, default_availability_percent, created_by)
  SELECT team_id, member_name, role, work_mode, default_availability_percent, created_by
  FROM need_link
  RETURNING id, team_id, member_name
)
UPDATE public.team_capacity_members tcm
SET team_member_id = tm.id
FROM public.team_members tm
WHERE tcm.team_member_id IS NULL
  AND tm.team_id = tcm.team_id
  AND tm.member_name = tcm.member_name;

-- 4) Auto-calc effective_capacity_days on insert/update (5-day baseline)
CREATE OR REPLACE FUNCTION public.calculate_effective_capacity(
  working_days INTEGER,
  leaves INTEGER,
  availability_percent INTEGER,
  work_mode TEXT,
  office_weight NUMERIC DEFAULT 1.0,
  wfh_weight NUMERIC DEFAULT 0.9,
  hybrid_weight NUMERIC DEFAULT 0.95
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  mode_weight NUMERIC;
BEGIN
  CASE work_mode
    WHEN 'office' THEN mode_weight := office_weight;
    WHEN 'wfh'    THEN mode_weight := wfh_weight;
    WHEN 'hybrid' THEN mode_weight := hybrid_weight;
    ELSE mode_weight := 1.0;
  END CASE;
  RETURN (working_days - COALESCE(leaves,0)) * (COALESCE(availability_percent,100)::NUMERIC / 100.0) * mode_weight;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_calc_tcm_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_working_days INT := 5; -- weekly baseline
BEGIN
  NEW.effective_capacity_days :=
    public.calculate_effective_capacity(
      base_working_days,
      COALESCE(NEW.leaves,0),
      COALESCE(NEW.availability_percent,100),
      COALESCE(NEW.work_mode,'office')
    );
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' AND NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tcm_calc_capacity ON public.team_capacity_members;
CREATE TRIGGER trg_tcm_calc_capacity
  BEFORE INSERT OR UPDATE ON public.team_capacity_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_calc_tcm_capacity();

COMMIT;
