-- Fix the remaining functions that need search_path

-- Fix log_discussion_changes function
CREATE OR REPLACE FUNCTION public.log_discussion_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
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
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- Fix log_task_status_change function
CREATE OR REPLACE FUNCTION public.log_task_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
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
$function$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
    -- Insert into profiles
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id, 
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
    );
    
    -- Assign Project Coordinator role by default (unless it's the admin email)
    IF NEW.email = 'admin@admin.com' THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin');
    ELSE
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'project_coordinator');
    END IF;
    
    RETURN NEW;
END;
$function$;