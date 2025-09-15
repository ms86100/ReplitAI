-- Fix the trigger to handle system updates gracefully
DROP TRIGGER IF EXISTS task_status_change_trigger ON public.tasks;

-- Update the function to handle null auth context
CREATE OR REPLACE FUNCTION public.log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if the status actually changed and we have a valid auth context
  IF OLD.status IS DISTINCT FROM NEW.status AND auth.uid() IS NOT NULL THEN
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

-- Recreate the trigger
CREATE TRIGGER task_status_change_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_task_status_change();

-- Now clean up corrupted task statuses
UPDATE public.tasks 
SET status = 'todo'
WHERE status ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Ensure all tasks have valid statuses
UPDATE public.tasks 
SET status = 'todo'
WHERE status NOT IN ('todo', 'in_progress', 'in_review', 'blocked', 'completed');