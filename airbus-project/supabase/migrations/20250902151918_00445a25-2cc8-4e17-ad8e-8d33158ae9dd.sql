-- Fix discussion change log trigger to handle edge function calls
-- First, temporarily disable the trigger
DROP TRIGGER IF EXISTS trigger_log_discussion_changes ON project_discussions;
DROP TRIGGER IF EXISTS trigger_log_discussion_action_item_changes ON discussion_action_items;

-- Check if the log_discussion_changes function exists and drop it
DROP FUNCTION IF EXISTS public.log_discussion_changes();

-- Recreate the function to handle null changed_by gracefully
CREATE OR REPLACE FUNCTION public.log_discussion_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log discussion changes - skip if changed_by would be null
  IF TG_TABLE_NAME = 'project_discussions' THEN
    IF TG_OP = 'INSERT' THEN
      -- Only insert if we have a valid user context
      IF auth.uid() IS NOT NULL THEN
        INSERT INTO public.discussion_change_log (
          discussion_id, change_type, field_name, new_value, changed_by
        ) VALUES (
          NEW.id, 'created', 'discussion', 'Discussion created', auth.uid()
        );
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Only log updates if we have a valid user context
      IF auth.uid() IS NOT NULL THEN
        IF OLD.meeting_title IS DISTINCT FROM NEW.meeting_title THEN
          INSERT INTO public.discussion_change_log (
            discussion_id, change_type, field_name, old_value, new_value, changed_by
          ) VALUES (
            NEW.id, 'updated', 'meeting_title', OLD.meeting_title, NEW.meeting_title, auth.uid()
          );
        END IF;
        IF OLD.summary_notes IS DISTINCT FROM NEW.summary_notes THEN
          INSERT INTO public.discussion_change_log (
            discussion_id, change_type, field_name, old_value, new_value, changed_by
          ) VALUES (
            NEW.id, 'updated', 'summary_notes', OLD.summary_notes, NEW.summary_notes, auth.uid()
          );
        END IF;
      END IF;
    END IF;
  -- Log action item changes
  ELSIF TG_TABLE_NAME = 'discussion_action_items' THEN
    IF TG_OP = 'INSERT' THEN
      IF auth.uid() IS NOT NULL THEN
        INSERT INTO public.discussion_change_log (
          discussion_id, action_item_id, change_type, field_name, new_value, changed_by
        ) VALUES (
          NEW.discussion_id, NEW.id, 'created', 'action_item', 'Action item created', auth.uid()
        );
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF auth.uid() IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.discussion_change_log (
          discussion_id, action_item_id, change_type, field_name, old_value, new_value, changed_by
        ) VALUES (
          NEW.discussion_id, NEW.id, 'updated', 'status', OLD.status, NEW.status, auth.uid()
        );
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      IF auth.uid() IS NOT NULL THEN
        INSERT INTO public.discussion_change_log (
          discussion_id, action_item_id, change_type, field_name, old_value, changed_by
        ) VALUES (
          OLD.discussion_id, OLD.id, 'deleted', 'action_item', 'Action item deleted', auth.uid()
        );
      END IF;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Recreate the triggers
CREATE TRIGGER trigger_log_discussion_changes
  AFTER INSERT OR UPDATE OR DELETE ON project_discussions
  FOR EACH ROW EXECUTE FUNCTION log_discussion_changes();

CREATE TRIGGER trigger_log_discussion_action_item_changes
  AFTER INSERT OR UPDATE OR DELETE ON discussion_action_items
  FOR EACH ROW EXECUTE FUNCTION log_discussion_changes();