-- Create teams table for organizing team members
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  department_id UUID
);

-- Enable RLS for teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create policies for teams
CREATE POLICY "Users can view teams in their projects" 
ON public.teams 
FOR SELECT 
USING (EXISTS ( SELECT 1
  FROM projects p
  WHERE p.id = teams.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can create teams in their projects" 
ON public.teams 
FOR INSERT 
WITH CHECK (EXISTS ( SELECT 1
  FROM projects p
  WHERE p.id = teams.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
) AND created_by = auth.uid());

CREATE POLICY "Users can update teams in their projects" 
ON public.teams 
FOR UPDATE 
USING (EXISTS ( SELECT 1
  FROM projects p
  WHERE p.id = teams.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can delete teams in their projects" 
ON public.teams 
FOR DELETE 
USING (EXISTS ( SELECT 1
  FROM projects p
  WHERE p.id = teams.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

-- Create team_members table for managing team membership
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  skills TEXT[],
  work_mode TEXT DEFAULT 'office',
  default_availability_percent INTEGER DEFAULT 100,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  department_id UUID
);

-- Enable RLS for team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Create policies for team_members
CREATE POLICY "Users can view team members in their teams" 
ON public.team_members 
FOR SELECT 
USING (EXISTS ( SELECT 1
  FROM teams t
  JOIN projects p ON p.id = t.project_id
  WHERE t.id = team_members.team_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can create team members in their teams" 
ON public.team_members 
FOR INSERT 
WITH CHECK (EXISTS ( SELECT 1
  FROM teams t
  JOIN projects p ON p.id = t.project_id
  WHERE t.id = team_members.team_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
) AND created_by = auth.uid());

CREATE POLICY "Users can update team members in their teams" 
ON public.team_members 
FOR UPDATE 
USING (EXISTS ( SELECT 1
  FROM teams t
  JOIN projects p ON p.id = t.project_id
  WHERE t.id = team_members.team_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can delete team members in their teams" 
ON public.team_members 
FOR DELETE 
USING (EXISTS ( SELECT 1
  FROM teams t
  JOIN projects p ON p.id = t.project_id
  WHERE t.id = team_members.team_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

-- Add triggers for automatic department assignment
CREATE TRIGGER trg_teams_set_department
  BEFORE INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.trg_teams_set_department();

CREATE TRIGGER trg_team_members_set_department
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_team_members_set_department();

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create helper functions for team management
CREATE OR REPLACE FUNCTION public.trg_teams_set_department()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_team_members_set_department()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;