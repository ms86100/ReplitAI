-- Create module_access_audit table for logging module access events in local backend
-- Also ensure required enums exist

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_name') THEN
    CREATE TYPE module_name AS ENUM ('roadmap', 'tasks_milestones', 'stakeholders', 'risk_register', 'discussions', 'task_backlog', 'retrospectives', 'team_capacity', 'budget_management');
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'module_name' AND e.enumlabel = 'budget_management'
  ) THEN
    ALTER TYPE module_name ADD VALUE 'budget_management';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_level') THEN
    CREATE TYPE access_level AS ENUM ('read', 'write');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.module_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  module module_name NOT NULL,
  access_type TEXT NOT NULL,
  access_level access_level,
  granted_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_access_audit_project ON public.module_access_audit(project_id);
