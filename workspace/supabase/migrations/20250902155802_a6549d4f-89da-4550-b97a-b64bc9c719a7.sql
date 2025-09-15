-- Add teams table and capacity analytics functionality

-- Create teams table for reusable team management
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  team_name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  department_id UUID
);

-- Enable RLS for teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for teams
CREATE POLICY "Users can manage teams in their projects" ON public.teams
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = teams.project_id 
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = teams.project_id 
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  ) AND created_by = auth.uid()
);

-- Create team_members table for managing members within teams
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  role TEXT NOT NULL,
  work_mode TEXT NOT NULL DEFAULT 'office',
  default_availability_percent INTEGER DEFAULT 100,
  stakeholder_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  department_id UUID
);

-- Enable RLS for team_members  
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for team_members
CREATE POLICY "Users can manage team members in their teams" ON public.team_members
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM teams t
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = team_members.team_id 
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teams t
    JOIN projects p ON p.id = t.project_id
    WHERE t.id = team_members.team_id 
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  ) AND created_by = auth.uid()
);

-- Create capacity analytics table
CREATE TABLE IF NOT EXISTS public.capacity_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  iteration_id UUID,
  team_id UUID,
  metrics_date DATE DEFAULT CURRENT_DATE,
  total_capacity_days NUMERIC DEFAULT 0,
  allocated_capacity_days NUMERIC DEFAULT 0,
  utilization_percentage NUMERIC DEFAULT 0,
  velocity_points INTEGER DEFAULT 0,
  team_size INTEGER DEFAULT 0,
  avg_member_capacity NUMERIC DEFAULT 0,
  work_mode_distribution JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for capacity_analytics
ALTER TABLE public.capacity_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for capacity_analytics
CREATE POLICY "Users can view analytics for their projects" ON public.capacity_analytics
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = capacity_analytics.project_id 
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "System can create analytics" ON public.capacity_analytics
FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update analytics" ON public.capacity_analytics
FOR UPDATE USING (true);

-- Create triggers for teams
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_capacity_analytics_updated_at
  BEFORE UPDATE ON public.capacity_analytics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Set department triggers for teams
CREATE TRIGGER trg_teams_set_department
  BEFORE INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.trg_projects_set_department();

CREATE TRIGGER trg_team_members_set_department
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_projects_set_department();

-- Create function to generate capacity analytics
CREATE OR REPLACE FUNCTION public.generate_capacity_analytics(_project_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  iter RECORD;
  team RECORD;
BEGIN
  -- Generate analytics for each iteration
  FOR iter IN 
    SELECT * FROM team_capacity_iterations 
    WHERE project_id = _project_id
  LOOP
    -- Calculate iteration-level analytics
    INSERT INTO capacity_analytics (
      project_id, iteration_id, metrics_date,
      total_capacity_days, team_size, avg_member_capacity,
      work_mode_distribution
    )
    SELECT 
      iter.project_id,
      iter.id,
      CURRENT_DATE,
      COALESCE(SUM(tcm.effective_capacity_days), 0),
      COUNT(tcm.id),
      COALESCE(AVG(tcm.effective_capacity_days), 0),
      jsonb_build_object(
        'office', COUNT(CASE WHEN tcm.work_mode = 'office' THEN 1 END),
        'wfh', COUNT(CASE WHEN tcm.work_mode = 'wfh' THEN 1 END),
        'hybrid', COUNT(CASE WHEN tcm.work_mode = 'hybrid' THEN 1 END)
      )
    FROM team_capacity_members tcm
    WHERE tcm.iteration_id = iter.id
    ON CONFLICT (project_id, iteration_id, metrics_date) 
    DO UPDATE SET
      total_capacity_days = EXCLUDED.total_capacity_days,
      team_size = EXCLUDED.team_size,
      avg_member_capacity = EXCLUDED.avg_member_capacity,
      work_mode_distribution = EXCLUDED.work_mode_distribution,
      updated_at = now();
  END LOOP;
  
  -- Generate team-level analytics
  FOR team IN 
    SELECT * FROM teams 
    WHERE project_id = _project_id
  LOOP
    INSERT INTO capacity_analytics (
      project_id, team_id, metrics_date, team_size
    )
    SELECT 
      team.project_id,
      team.id,
      CURRENT_DATE,
      COUNT(tm.id)
    FROM team_members tm
    WHERE tm.team_id = team.id
    ON CONFLICT (project_id, team_id, metrics_date) 
    DO UPDATE SET
      team_size = EXCLUDED.team_size,
      updated_at = now();
  END LOOP;
END;
$$;