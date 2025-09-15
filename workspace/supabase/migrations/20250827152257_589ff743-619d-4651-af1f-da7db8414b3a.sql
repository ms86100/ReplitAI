-- Create table for task status history
CREATE TABLE public.task_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

-- Create policies for task status history
CREATE POLICY "Users can view task status history in their projects" 
ON public.task_status_history 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = task_status_history.task_id
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

CREATE POLICY "Users can create status history for tasks in their projects" 
ON public.task_status_history 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.projects p ON t.project_id = p.id
    WHERE t.id = task_status_history.task_id
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
  AND changed_by = auth.uid()
);

-- Create indexes for better performance
CREATE INDEX idx_task_status_history_task_id ON public.task_status_history(task_id);
CREATE INDEX idx_task_status_history_changed_at ON public.task_status_history(changed_at);

-- Create function to automatically log status changes
CREATE OR REPLACE FUNCTION public.log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_status_history (
      task_id,
      old_status,
      new_status,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically log status changes
CREATE TRIGGER task_status_change_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_task_status_change();