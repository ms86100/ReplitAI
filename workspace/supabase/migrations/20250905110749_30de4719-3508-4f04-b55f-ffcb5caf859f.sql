-- Align Supabase schema for Team Capacity: add team_members and team_member_id linkage

-- 1) Create team_members table if missing
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

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_team_members_updated_at ON public.team_members;
CREATE TRIGGER trg_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Policies: view/manage within own projects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='Users can view team members in their projects'
  ) THEN
    CREATE POLICY "Users can view team members in their projects"
    ON public.team_members FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.projects p ON p.id = t.project_id
        LEFT JOIN public.project_members pm ON pm.project_id = p.id
        WHERE t.id = team_members.team_id
          AND (p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR pm.user_id = auth.uid())
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='Users can manage team members in their projects'
  ) THEN
    CREATE POLICY "Users can manage team members in their projects"
    ON public.team_members FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.projects p ON p.id = t.project_id
        LEFT JOIN public.project_members pm ON pm.project_id = p.id
        WHERE t.id = team_members.team_id
          AND (p.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR pm.user_id = auth.uid())
      )
    ) WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- 2) Add team_member_id to team_capacity_members if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='team_capacity_members' AND column_name='team_member_id'
  ) THEN
    ALTER TABLE public.team_capacity_members ADD COLUMN team_member_id UUID;
  END IF;
END $$;

-- Index for quick joins
CREATE INDEX IF NOT EXISTS idx_team_capacity_members_team_member_id ON public.team_capacity_members(team_member_id);

-- 3) Backfill team_members from existing rows and link
-- Create missing team_members based on distinct (team_id, member_name)
WITH inserted AS (
  INSERT INTO public.team_members (team_id, member_name, role, work_mode, default_availability_percent, created_by)
  SELECT DISTINCT tcm.team_id,
         tcm.member_name,
         tcm.role,
         COALESCE(tcm.work_mode, 'office'),
         COALESCE(tcm.availability_percent, 100),
         COALESCE(tcm.created_by, auth.uid())
  FROM public.team_capacity_members tcm
  LEFT JOIN public.team_members tm
    ON tm.team_id = tcm.team_id AND tm.member_name = tcm.member_name
  WHERE tcm.team_member_id IS NULL AND tm.id IS NULL
  RETURNING id, team_id, member_name
)
UPDATE public.team_capacity_members tcm
SET team_member_id = tm.id
FROM public.team_members tm
WHERE tcm.team_member_id IS NULL
  AND tm.team_id = tcm.team_id
  AND tm.member_name = tcm.member_name;

-- 4) Optional uniqueness to prevent duplicates per iteration
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