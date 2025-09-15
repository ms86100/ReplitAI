-- Create stakeholders table for project stakeholder management
CREATE TABLE public.stakeholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  raci TEXT CHECK (raci IN ('Responsible', 'Accountable', 'Consulted', 'Informed')),
  influence_level TEXT CHECK (influence_level IN ('Low', 'Medium', 'High', 'Critical')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;

-- Create policies for stakeholders
CREATE POLICY "Users can view stakeholders in their projects" 
ON public.stakeholders 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = stakeholders.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can create stakeholders in their projects" 
ON public.stakeholders 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = stakeholders.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
) AND created_by = auth.uid());

CREATE POLICY "Users can update stakeholders in their projects" 
ON public.stakeholders 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = stakeholders.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can delete stakeholders in their projects" 
ON public.stakeholders 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM projects p 
  WHERE p.id = stakeholders.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

-- Add trigger for updated_at
CREATE TRIGGER update_stakeholders_updated_at
BEFORE UPDATE ON public.stakeholders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update tasks table to reference stakeholders for task assignment
-- First, make owner_id nullable if it isn't already
ALTER TABLE public.tasks ALTER COLUMN owner_id DROP NOT NULL;

-- Add a reference to stakeholders table
-- Note: We don't add a foreign key constraint because owner_id might reference 
-- either stakeholders.id or auth users directly for flexibility