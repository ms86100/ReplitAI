-- Create team capacity settings table
CREATE TABLE public.team_capacity_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  iteration_basis TEXT NOT NULL DEFAULT 'days',
  work_week INTEGER NOT NULL DEFAULT 5,
  office_weight NUMERIC NOT NULL DEFAULT 1.0,
  wfh_weight NUMERIC NOT NULL DEFAULT 0.9,
  hybrid_weight NUMERIC NOT NULL DEFAULT 0.95,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team capacity iterations table
CREATE TABLE public.team_capacity_iterations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  iteration_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  working_days INTEGER NOT NULL,
  committed_story_points INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  department_id UUID
);

-- Create team capacity members table
CREATE TABLE public.team_capacity_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iteration_id UUID NOT NULL,
  member_name TEXT NOT NULL,
  role TEXT NOT NULL,
  work_mode TEXT NOT NULL CHECK (work_mode IN ('office', 'wfh', 'hybrid')),
  leaves INTEGER NOT NULL DEFAULT 0,
  availability_percent INTEGER NOT NULL DEFAULT 100 CHECK (availability_percent >= 0 AND availability_percent <= 100),
  effective_capacity_days NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  department_id UUID
);

-- Enable Row Level Security
ALTER TABLE public.team_capacity_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_capacity_iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_capacity_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for team_capacity_settings
CREATE POLICY "Users can view capacity settings in their projects" 
ON public.team_capacity_settings 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = team_capacity_settings.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can create capacity settings in their projects" 
ON public.team_capacity_settings 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = team_capacity_settings.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
) AND created_by = auth.uid());

CREATE POLICY "Users can update capacity settings in their projects" 
ON public.team_capacity_settings 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = team_capacity_settings.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can delete capacity settings in their projects" 
ON public.team_capacity_settings 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = team_capacity_settings.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

-- Create RLS policies for team_capacity_iterations
CREATE POLICY "Users can view capacity iterations in their projects" 
ON public.team_capacity_iterations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = team_capacity_iterations.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can create capacity iterations in their projects" 
ON public.team_capacity_iterations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = team_capacity_iterations.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
) AND created_by = auth.uid());

CREATE POLICY "Users can update capacity iterations in their projects" 
ON public.team_capacity_iterations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = team_capacity_iterations.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can delete capacity iterations in their projects" 
ON public.team_capacity_iterations 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = team_capacity_iterations.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

-- Create RLS policies for team_capacity_members
CREATE POLICY "Users can view capacity members in their projects" 
ON public.team_capacity_members 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM team_capacity_iterations tci 
  JOIN projects p ON p.id = tci.project_id 
  WHERE tci.id = team_capacity_members.iteration_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can create capacity members in their projects" 
ON public.team_capacity_members 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM team_capacity_iterations tci 
  JOIN projects p ON p.id = tci.project_id 
  WHERE tci.id = team_capacity_members.iteration_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
) AND created_by = auth.uid());

CREATE POLICY "Users can update capacity members in their projects" 
ON public.team_capacity_members 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM team_capacity_iterations tci 
  JOIN projects p ON p.id = tci.project_id 
  WHERE tci.id = team_capacity_members.iteration_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can delete capacity members in their projects" 
ON public.team_capacity_members 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM team_capacity_iterations tci 
  JOIN projects p ON p.id = tci.project_id 
  WHERE tci.id = team_capacity_members.iteration_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

-- Create triggers for department assignment
CREATE TRIGGER trg_team_capacity_settings_set_department
  BEFORE INSERT ON public.team_capacity_settings
  FOR EACH ROW EXECUTE FUNCTION public.trg_task_backlog_set_department();

CREATE TRIGGER trg_team_capacity_iterations_set_department
  BEFORE INSERT ON public.team_capacity_iterations
  FOR EACH ROW EXECUTE FUNCTION public.trg_task_backlog_set_department();

CREATE TRIGGER trg_team_capacity_members_set_department
  BEFORE INSERT ON public.team_capacity_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_task_backlog_set_department();

-- Create triggers for updated_at
CREATE TRIGGER update_team_capacity_settings_updated_at
  BEFORE UPDATE ON public.team_capacity_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_capacity_iterations_updated_at
  BEFORE UPDATE ON public.team_capacity_iterations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_capacity_members_updated_at
  BEFORE UPDATE ON public.team_capacity_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create a function to calculate effective capacity
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
  -- Get the weight based on work mode
  CASE work_mode
    WHEN 'office' THEN mode_weight := office_weight;
    WHEN 'wfh' THEN mode_weight := wfh_weight;
    WHEN 'hybrid' THEN mode_weight := hybrid_weight;
    ELSE mode_weight := 1.0;
  END CASE;
  
  -- Calculate effective capacity: (working_days - leaves) * (availability_percent/100) * mode_weight
  RETURN (working_days - leaves) * (availability_percent::NUMERIC / 100.0) * mode_weight;
END;
$$;