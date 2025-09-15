-- Create risk register table for project risks
CREATE TABLE IF NOT EXISTS public.risk_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  created_by uuid NOT NULL,
  department_id uuid,

  -- Business fields
  risk_code text NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  cause text,
  consequence text,

  likelihood integer CHECK (likelihood BETWEEN 1 AND 5),
  impact integer CHECK (impact BETWEEN 1 AND 5),
  risk_score integer GENERATED ALWAYS AS (likelihood * impact) STORED,

  owner text,
  response_strategy text,
  mitigation_plan text[],
  contingency_plan text,

  status text DEFAULT 'open',
  identified_date date,
  last_updated date,
  next_review_date date,

  residual_likelihood integer CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact integer CHECK (residual_impact BETWEEN 1 AND 5),
  residual_risk_score integer GENERATED ALWAYS AS (residual_likelihood * residual_impact) STORED,

  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_risk_code_per_project UNIQUE (project_id, risk_code)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_risk_register_project ON public.risk_register(project_id);
CREATE INDEX IF NOT EXISTS idx_risk_register_status ON public.risk_register(status);
CREATE INDEX IF NOT EXISTS idx_risk_register_department ON public.risk_register(department_id);

-- Enable Row Level Security
ALTER TABLE public.risk_register ENABLE ROW LEVEL SECURITY;

-- Policies similar to tasks/stakeholders
CREATE POLICY "Users can create risks in their projects"
ON public.risk_register
FOR INSERT
WITH CHECK (
  (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = risk_register.project_id
        AND (
          p.created_by = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
          )
        )
    )
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can view risks in their projects"
ON public.risk_register
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = risk_register.project_id
      AND (
        p.created_by = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Users can update risks in their projects"
ON public.risk_register
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = risk_register.project_id
      AND (
        p.created_by = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "Users can delete risks in their projects"
ON public.risk_register
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = risk_register.project_id
      AND (
        p.created_by = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
      )
  )
);

-- Trigger to auto-fill department_id from user profile on insert
CREATE OR REPLACE FUNCTION public.trg_risk_register_set_department()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_risk_register_department
BEFORE INSERT ON public.risk_register
FOR EACH ROW EXECUTE FUNCTION public.trg_risk_register_set_department();

-- Trigger to maintain updated_at
CREATE TRIGGER update_risk_register_updated_at
BEFORE UPDATE ON public.risk_register
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();