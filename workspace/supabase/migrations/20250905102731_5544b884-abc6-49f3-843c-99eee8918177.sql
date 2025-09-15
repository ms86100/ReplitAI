-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID,
  display_name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create iterations table
CREATE TABLE IF NOT EXISTS public.iterations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'iteration' CHECK (type IN ('iteration', 'sprint', 'cycle')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  weeks_count INTEGER NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_dates CHECK (start_date < end_date)
);

-- Create iteration_weeks table
CREATE TABLE IF NOT EXISTS public.iteration_weeks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iteration_id UUID NOT NULL REFERENCES public.iterations(id) ON DELETE CASCADE,
  week_index INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create member_weekly_availability table
CREATE TABLE IF NOT EXISTS public.member_weekly_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iteration_week_id UUID NOT NULL REFERENCES public.iteration_weeks(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  availability_percent INTEGER NOT NULL DEFAULT 100 CHECK (availability_percent >= 0 AND availability_percent <= 100),
  calculated_days_present INTEGER NOT NULL DEFAULT 5,
  calculated_days_total INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create daily_attendance table
CREATE TABLE IF NOT EXISTS public.daily_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_weekly_availability_id UUID NOT NULL REFERENCES public.member_weekly_availability(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  status TEXT NOT NULL DEFAULT 'P' CHECK (status IN ('P', 'A')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iteration_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_weekly_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams
CREATE POLICY "Users can view teams in their projects" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = teams.project_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
           EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can create teams in their projects" ON public.teams
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = teams.project_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Users can update teams in their projects" ON public.teams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = teams.project_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Users can delete teams in their projects" ON public.teams
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = teams.project_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- RLS Policies for team_members
CREATE POLICY "Users can view team members in their projects" ON public.team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams t 
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = team_members.team_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
           EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can manage team members in their projects" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teams t 
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = team_members.team_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- RLS Policies for iterations
CREATE POLICY "Users can view iterations in their projects" ON public.iterations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = iterations.project_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
           EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can manage iterations in their projects" ON public.iterations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = iterations.project_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = iterations.project_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    ) AND created_by = auth.uid()
  );

-- RLS Policies for iteration_weeks
CREATE POLICY "Users can view iteration weeks in their projects" ON public.iteration_weeks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.iterations i
      JOIN public.projects p ON p.id = i.project_id
      WHERE i.id = iteration_weeks.iteration_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
           EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can manage iteration weeks in their projects" ON public.iteration_weeks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.iterations i
      JOIN public.projects p ON p.id = i.project_id
      WHERE i.id = iteration_weeks.iteration_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- RLS Policies for member_weekly_availability
CREATE POLICY "Users can view availability in their projects" ON public.member_weekly_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.iteration_weeks iw
      JOIN public.iterations i ON i.id = iw.iteration_id
      JOIN public.projects p ON p.id = i.project_id
      WHERE iw.id = member_weekly_availability.iteration_week_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
           EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can manage availability in their projects" ON public.member_weekly_availability
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.iteration_weeks iw
      JOIN public.iterations i ON i.id = iw.iteration_id
      JOIN public.projects p ON p.id = i.project_id
      WHERE iw.id = member_weekly_availability.iteration_week_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- RLS Policies for daily_attendance
CREATE POLICY "Users can view attendance in their projects" ON public.daily_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.member_weekly_availability mwa
      JOIN public.iteration_weeks iw ON iw.id = mwa.iteration_week_id
      JOIN public.iterations i ON i.id = iw.iteration_id
      JOIN public.projects p ON p.id = i.project_id
      WHERE mwa.id = daily_attendance.member_weekly_availability_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
           EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can manage attendance in their projects" ON public.daily_attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.member_weekly_availability mwa
      JOIN public.iteration_weeks iw ON iw.id = mwa.iteration_week_id
      JOIN public.iterations i ON i.id = iw.iteration_id
      JOIN public.projects p ON p.id = i.project_id
      WHERE mwa.id = daily_attendance.member_weekly_availability_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- Add update triggers
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_iterations_updated_at
  BEFORE UPDATE ON public.iterations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_iteration_weeks_updated_at
  BEFORE UPDATE ON public.iteration_weeks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_member_weekly_availability_updated_at
  BEFORE UPDATE ON public.member_weekly_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();