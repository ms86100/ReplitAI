-- First find and drop all triggers that depend on log_discussion_changes
DROP TRIGGER IF EXISTS log_discussion_changes_trigger ON project_discussions;
DROP TRIGGER IF EXISTS log_action_item_changes_trigger ON discussion_action_items;
DROP TRIGGER IF EXISTS trigger_log_discussion_changes ON project_discussions;
DROP TRIGGER IF EXISTS trigger_log_discussion_action_item_changes ON discussion_action_items;

-- Now drop the function
DROP FUNCTION IF EXISTS public.log_discussion_changes() CASCADE;

-- Recreate the function to handle null changed_by gracefully
CREATE OR REPLACE FUNCTION public.log_discussion_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip logging if we don't have auth context (e.g., from edge functions)
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Log discussion changes
  IF TG_TABLE_NAME = 'project_discussions' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.discussion_change_log (
        discussion_id, change_type, field_name, new_value, changed_by
      ) VALUES (
        NEW.id, 'created', 'discussion', 'Discussion created', auth.uid()
      );
    ELSIF TG_OP = 'UPDATE' THEN
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
  -- Log action item changes
  ELSIF TG_TABLE_NAME = 'discussion_action_items' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.discussion_change_log (
        discussion_id, action_item_id, change_type, field_name, new_value, changed_by
      ) VALUES (
        NEW.discussion_id, NEW.id, 'created', 'action_item', 'Action item created', auth.uid()
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.discussion_change_log (
          discussion_id, action_item_id, change_type, field_name, old_value, new_value, changed_by
        ) VALUES (
          NEW.discussion_id, NEW.id, 'updated', 'status', OLD.status, NEW.status, auth.uid()
        );
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO public.discussion_change_log (
        discussion_id, action_item_id, change_type, field_name, old_value, changed_by
      ) VALUES (
        OLD.discussion_id, OLD.id, 'deleted', 'action_item', 'Action item deleted', auth.uid()
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate the triggers with consistent naming
CREATE TRIGGER log_discussion_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON project_discussions
  FOR EACH ROW EXECUTE FUNCTION log_discussion_changes();

CREATE TRIGGER log_action_item_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON discussion_action_items
  FOR EACH ROW EXECUTE FUNCTION log_discussion_changes();