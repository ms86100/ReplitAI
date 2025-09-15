-- Create weekly availability table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.weekly_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iteration_week_id UUID NOT NULL REFERENCES public.iteration_weeks(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  availability_percent INTEGER NOT NULL DEFAULT 100 CHECK (availability_percent >= 0 AND availability_percent <= 100),
  calculated_days_present NUMERIC NOT NULL DEFAULT 0,
  calculated_days_total NUMERIC NOT NULL DEFAULT 5,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(iteration_week_id, team_member_id)
);

-- Enable RLS
ALTER TABLE public.weekly_availability ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage weekly availability in their projects" 
ON public.weekly_availability 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.iteration_weeks iw
    JOIN public.team_capacity_iterations tci ON iw.iteration_id = tci.id
    JOIN public.projects p ON tci.project_id = p.id
    WHERE iw.id = weekly_availability.iteration_week_id
    AND (
      p.created_by = auth.uid() OR 
      has_role(auth.uid(), 'admin'::app_role) OR 
      EXISTS (
        SELECT 1 FROM public.project_members pm 
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.iteration_weeks iw
    JOIN public.team_capacity_iterations tci ON iw.iteration_id = tci.id
    JOIN public.projects p ON tci.project_id = p.id
    WHERE iw.id = weekly_availability.iteration_week_id
    AND (
      p.created_by = auth.uid() OR 
      has_role(auth.uid(), 'admin'::app_role) OR 
      EXISTS (
        SELECT 1 FROM public.project_members pm 
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_weekly_availability_updated_at
    BEFORE UPDATE ON public.weekly_availability
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();