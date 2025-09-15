-- Create milestones table first
CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create tasks table after milestones
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on both tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Create policies for tasks
CREATE POLICY "Users can view tasks in their projects"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = tasks.project_id
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

CREATE POLICY "Users can create tasks in their projects"
ON public.tasks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = tasks.project_id
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update tasks in their projects"
ON public.tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = tasks.project_id
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

CREATE POLICY "Users can delete tasks in their projects"
ON public.tasks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = tasks.project_id
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

-- Create policies for milestones
CREATE POLICY "Users can view milestones in their projects"
ON public.milestones
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = milestones.project_id
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

CREATE POLICY "Users can create milestones in their projects"
ON public.milestones
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = milestones.project_id
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update milestones in their projects"
ON public.milestones
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = milestones.project_id
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

CREATE POLICY "Users can delete milestones in their projects"
ON public.milestones
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = milestones.project_id
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

-- Create triggers for updated_at columns
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_milestone_id ON public.tasks(milestone_id);
CREATE INDEX idx_tasks_owner_id ON public.tasks(owner_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_milestones_project_id ON public.milestones(project_id);
CREATE INDEX idx_milestones_due_date ON public.milestones(due_date);