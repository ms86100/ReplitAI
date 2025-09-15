-- Add stakeholder_id to team_capacity_members to link to project stakeholders
ALTER TABLE public.team_capacity_members
ADD COLUMN IF NOT EXISTS stakeholder_id uuid REFERENCES public.stakeholders(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_capacity_members_stakeholder_id
  ON public.team_capacity_members(stakeholder_id);
