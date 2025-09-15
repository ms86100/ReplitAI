-- Fix security warnings by setting search_path for new functions
CREATE OR REPLACE FUNCTION public.log_module_access(_user_id UUID, _project_id UUID, _module module_name, _access_type TEXT, _access_level access_level DEFAULT NULL, _granted_by UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.module_access_audit (user_id, project_id, module, access_type, access_level, granted_by)
  VALUES (_user_id, _project_id, _module, _access_type, _access_level, _granted_by);
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_log_module_permission_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_module_access(NEW.user_id, NEW.project_id, NEW.module, 'granted', NEW.access_level, NEW.granted_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.access_level IS DISTINCT FROM NEW.access_level THEN
      PERFORM public.log_module_access(NEW.user_id, NEW.project_id, NEW.module, 'updated', NEW.access_level, NEW.granted_by);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_module_access(OLD.user_id, OLD.project_id, OLD.module, 'revoked', OLD.access_level, OLD.granted_by);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;