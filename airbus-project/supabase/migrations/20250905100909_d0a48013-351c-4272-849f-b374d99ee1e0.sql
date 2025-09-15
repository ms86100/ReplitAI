-- Create weekly availability tracking tables
CREATE TABLE IF NOT EXISTS public.iteration_weeks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iteration_id UUID NOT NULL REFERENCES public.team_capacity_iterations(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for iteration_weeks
ALTER TABLE public.iteration_weeks ENABLE ROW LEVEL SECURITY;

-- Create policies for iteration_weeks
CREATE POLICY "Users can view iteration weeks in their projects" 
ON public.iteration_weeks 
FOR SELECT 
USING (EXISTS ( SELECT 1
  FROM team_capacity_iterations tci
  JOIN projects p ON p.id = tci.project_id
  WHERE tci.id = iteration_weeks.iteration_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can manage iteration weeks in their projects" 
ON public.iteration_weeks 
FOR ALL 
USING (EXISTS ( SELECT 1
  FROM team_capacity_iterations tci
  JOIN projects p ON p.id = tci.project_id
  WHERE tci.id = iteration_weeks.iteration_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

-- Create weekly member availability table
CREATE TABLE IF NOT EXISTS public.weekly_member_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iteration_week_id UUID NOT NULL REFERENCES public.iteration_weeks(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  availability_percent INTEGER NOT NULL DEFAULT 100,
  leaves INTEGER NOT NULL DEFAULT 0,
  effective_capacity NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(iteration_week_id, team_member_id)
);

-- Enable RLS for weekly_member_availability
ALTER TABLE public.weekly_member_availability ENABLE ROW LEVEL SECURITY;

-- Create policies for weekly_member_availability
CREATE POLICY "Users can view weekly availability in their projects" 
ON public.weekly_member_availability 
FOR SELECT 
USING (EXISTS ( SELECT 1
  FROM iteration_weeks iw
  JOIN team_capacity_iterations tci ON tci.id = iw.iteration_id
  JOIN projects p ON p.id = tci.project_id
  WHERE iw.id = weekly_member_availability.iteration_week_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

CREATE POLICY "Users can manage weekly availability in their projects" 
ON public.weekly_member_availability 
FOR ALL 
USING (EXISTS ( SELECT 1
  FROM iteration_weeks iw
  JOIN team_capacity_iterations tci ON tci.id = iw.iteration_id
  JOIN projects p ON p.id = tci.project_id
  WHERE iw.id = weekly_member_availability.iteration_week_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
       EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
));

-- Add team_id to team_capacity_iterations table
ALTER TABLE public.team_capacity_iterations 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_iteration_weeks_updated_at
  BEFORE UPDATE ON public.iteration_weeks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weekly_member_availability_updated_at
  BEFORE UPDATE ON public.weekly_member_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate effective capacity for weekly availability
CREATE OR REPLACE FUNCTION public.calculate_weekly_effective_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_work_mode TEXT;
BEGIN
  -- Get the team member's work mode
  SELECT work_mode INTO member_work_mode
  FROM team_members
  WHERE id = NEW.team_member_id;
  
  -- Calculate effective capacity based on 5 working days per week
  NEW.effective_capacity := public.calculate_effective_capacity(
    5, -- 5 working days per week
    NEW.leaves,
    NEW.availability_percent,
    COALESCE(member_work_mode, 'office')
  );
  
  RETURN NEW;
END;
$$;

-- Add trigger to automatically calculate effective capacity
CREATE TRIGGER trg_calculate_weekly_effective_capacity
  BEFORE INSERT OR UPDATE ON public.weekly_member_availability
  FOR EACH ROW EXECUTE FUNCTION public.calculate_weekly_effective_capacity();