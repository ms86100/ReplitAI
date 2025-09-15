-- Create trigger to log task status changes
CREATE TRIGGER trg_log_task_status_changes
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.log_task_status_change();

-- Ensure task_status_history table has proper RLS policies
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view task status history in their projects" ON public.task_status_history;
DROP POLICY IF EXISTS "System can log task status changes" ON public.task_status_history;

-- Users can view task status history for tasks in their projects
CREATE POLICY "Users can view task status history in their projects" 
ON public.task_status_history 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.id = task_status_history.task_id 
    AND (
      p.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
);

-- System can create task status history entries
CREATE POLICY "System can log task status changes" 
ON public.task_status_history 
FOR INSERT 
WITH CHECK (true);