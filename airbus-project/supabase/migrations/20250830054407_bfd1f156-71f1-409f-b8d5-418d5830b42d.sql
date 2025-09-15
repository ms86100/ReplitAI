-- Create teams table for named team groups
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  team_name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on teams table
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create policies for teams
CREATE POLICY "Users can view teams in their projects" 
ON public.teams 
FOR SELECT 
USING (EXISTS (
  SELECT 1
  FROM projects p
  WHERE p.id = teams.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can create teams in their projects" 
ON public.teams 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1
  FROM projects p
  WHERE p.id = teams.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
) AND created_by = auth.uid());

CREATE POLICY "Users can update teams in their projects" 
ON public.teams 
FOR UPDATE 
USING (EXISTS (
  SELECT 1
  FROM projects p
  WHERE p.id = teams.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can delete teams in their projects" 
ON public.teams 
FOR DELETE 
USING (EXISTS (
  SELECT 1
  FROM projects p
  WHERE p.id = teams.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

-- Create team definitions table for default member settings
CREATE TABLE public.team_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  stakeholder_id UUID NOT NULL,
  default_availability_percent INTEGER NOT NULL DEFAULT 100,
  default_leaves INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, stakeholder_id)
);

-- Enable RLS on team_definitions table
ALTER TABLE public.team_definitions ENABLE ROW LEVEL SECURITY;

-- Create policies for team_definitions
CREATE POLICY "Users can view team definitions in their projects" 
ON public.team_definitions 
FOR SELECT 
USING (EXISTS (
  SELECT 1
  FROM teams t
  JOIN projects p ON p.id = t.project_id
  WHERE t.id = team_definitions.team_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can create team definitions in their projects" 
ON public.team_definitions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1
  FROM teams t
  JOIN projects p ON p.id = t.project_id
  WHERE t.id = team_definitions.team_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
) AND created_by = auth.uid());

CREATE POLICY "Users can update team definitions in their projects" 
ON public.team_definitions 
FOR UPDATE 
USING (EXISTS (
  SELECT 1
  FROM teams t
  JOIN projects p ON p.id = t.project_id
  WHERE t.id = team_definitions.team_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can delete team definitions in their projects" 
ON public.team_definitions 
FOR DELETE 
USING (EXISTS (
  SELECT 1
  FROM teams t
  JOIN projects p ON p.id = t.project_id
  WHERE t.id = team_definitions.team_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1
    FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

-- Add team_id to team_capacity_members to track which team was used
ALTER TABLE public.team_capacity_members ADD COLUMN team_id UUID;

-- Create trigger for updated_at on teams
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on team_definitions
CREATE TRIGGER update_team_definitions_updated_at
  BEFORE UPDATE ON public.team_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();