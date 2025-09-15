-- Add audit logging for module access control
CREATE TABLE IF NOT EXISTS public.module_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL,
  module module_name NOT NULL,
  access_type TEXT NOT NULL, -- 'granted', 'revoked', 'accessed'
  access_level access_level,
  granted_by UUID,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on audit table
ALTER TABLE public.module_access_audit ENABLE ROW LEVEL SECURITY;

-- Create policies for audit table
CREATE POLICY "Project owners and admins can view access audit"
  ON public.module_access_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = module_access_audit.project_id 
      AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "System can create audit entries"
  ON public.module_access_audit FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to log module access
CREATE OR REPLACE FUNCTION public.log_module_access(_user_id UUID, _project_id UUID, _module module_name, _access_type TEXT, _access_level access_level DEFAULT NULL, _granted_by UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.module_access_audit (user_id, project_id, module, access_type, access_level, granted_by)
  VALUES (_user_id, _project_id, _module, _access_type, _access_level, _granted_by);
END;
$$;

-- Create trigger function for module permissions changes
CREATE OR REPLACE FUNCTION public.trigger_log_module_permission_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create trigger for module permissions audit
DROP TRIGGER IF EXISTS module_permission_audit_trigger ON public.module_permissions;
CREATE TRIGGER module_permission_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.module_permissions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_log_module_permission_changes();