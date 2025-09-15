-- Create task_backlog table to store action items converted to tasks
CREATE TABLE public.task_backlog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  priority TEXT DEFAULT 'medium'::text,
  status TEXT NOT NULL DEFAULT 'backlog'::text,
  owner_id UUID,
  target_date DATE,
  source_type TEXT DEFAULT 'manual'::text, -- 'manual' or 'action_item'
  source_id UUID, -- reference to discussion_action_items.id if converted from action item
  department_id UUID
);

-- Enable Row Level Security
ALTER TABLE public.task_backlog ENABLE ROW LEVEL SECURITY;

-- Create policies for task backlog
CREATE POLICY "Users can view backlog items in their projects" 
ON public.task_backlog 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = task_backlog.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can create backlog items in their projects" 
ON public.task_backlog 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = task_backlog.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
) AND created_by = auth.uid());

CREATE POLICY "Users can update backlog items in their projects" 
ON public.task_backlog 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = task_backlog.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

CREATE POLICY "Users can delete backlog items in their projects" 
ON public.task_backlog 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = task_backlog.project_id 
  AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
  ))
));

-- Create trigger for updating updated_at timestamp
CREATE TRIGGER update_task_backlog_updated_at
BEFORE UPDATE ON public.task_backlog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to set department_id automatically
CREATE OR REPLACE FUNCTION public.trg_task_backlog_set_department()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_task_backlog_set_department
BEFORE INSERT ON public.task_backlog
FOR EACH ROW
EXECUTE FUNCTION public.trg_task_backlog_set_department();