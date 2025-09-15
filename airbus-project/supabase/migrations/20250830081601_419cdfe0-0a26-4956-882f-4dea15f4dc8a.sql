-- Create module permissions enum
CREATE TYPE public.module_name AS ENUM (
  'overview',
  'tasks_milestones', 
  'roadmap',
  'kanban',
  'stakeholders',
  'risk_register',
  'discussions',
  'task_backlog',
  'team_capacity',
  'retrospectives'
);

-- Create access level enum
CREATE TYPE public.access_level AS ENUM ('read', 'write');

-- Create module permissions table
CREATE TABLE public.module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module module_name NOT NULL,
  access_level access_level NOT NULL DEFAULT 'read',
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id, module)
);

-- Enable RLS on module permissions
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for module permissions
CREATE POLICY "Project owners and admins can manage module permissions"
ON public.module_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = module_permissions.project_id
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Users can view their own module permissions"
ON public.module_permissions
FOR SELECT
USING (user_id = auth.uid());

-- Create audit log table for tracking changes
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  module module_name NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create policies for audit log
CREATE POLICY "Users can view audit log for their projects"
ON public.audit_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = audit_log.project_id
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
         OR EXISTS (
           SELECT 1 FROM public.project_members pm
           WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
         ))
  )
);

CREATE POLICY "System can create audit log entries"
ON public.audit_log
FOR INSERT
WITH CHECK (true);

-- Create function to check module permissions
CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id UUID, _project_id UUID, _module module_name, _required_access access_level)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Project owner has full access
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.created_by = _user_id
  )
  OR
  -- Admin has full access
  has_role(_user_id, 'admin'::app_role)
  OR
  -- Check specific module permission
  EXISTS (
    SELECT 1 FROM public.module_permissions mp
    WHERE mp.project_id = _project_id 
    AND mp.user_id = _user_id 
    AND mp.module = _module
    AND (mp.access_level = 'write' OR (_required_access = 'read' AND mp.access_level = 'read'))
  );
$$;

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION public.log_audit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_id UUID;
  _module module_name;
  _entity_type TEXT;
  _action TEXT;
  _description TEXT;
BEGIN
  -- Determine project_id and module based on table
  CASE TG_TABLE_NAME
    WHEN 'tasks' THEN
      _project_id := COALESCE(NEW.project_id, OLD.project_id);
      _module := 'tasks_milestones';
      _entity_type := 'task';
    WHEN 'milestones' THEN
      _project_id := COALESCE(NEW.project_id, OLD.project_id);
      _module := 'tasks_milestones';
      _entity_type := 'milestone';
    WHEN 'stakeholders' THEN
      _project_id := COALESCE(NEW.project_id, OLD.project_id);
      _module := 'stakeholders';
      _entity_type := 'stakeholder';
    WHEN 'risk_register' THEN
      _project_id := COALESCE(NEW.project_id, OLD.project_id);
      _module := 'risk_register';
      _entity_type := 'risk';
    WHEN 'project_discussions' THEN
      _project_id := COALESCE(NEW.project_id, OLD.project_id);
      _module := 'discussions';
      _entity_type := 'discussion';
    WHEN 'task_backlog' THEN
      _project_id := COALESCE(NEW.project_id, OLD.project_id);
      _module := 'task_backlog';
      _entity_type := 'backlog_item';
    WHEN 'retrospectives' THEN
      _project_id := COALESCE(NEW.project_id, OLD.project_id);
      _module := 'retrospectives';
      _entity_type := 'retrospective';
    WHEN 'team_capacity_iterations' THEN
      _project_id := COALESCE(NEW.project_id, OLD.project_id);
      _module := 'team_capacity';
      _entity_type := 'capacity_iteration';
    ELSE
      RETURN COALESCE(NEW, OLD);
  END CASE;

  -- Determine action
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _description := _entity_type || ' created';
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated';
    _description := _entity_type || ' updated';
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'deleted';
    _description := _entity_type || ' deleted';
  END IF;

  -- Insert audit log entry
  INSERT INTO public.audit_log (
    project_id,
    user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    description
  ) VALUES (
    _project_id,
    auth.uid(),
    _module,
    _action,
    _entity_type,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
    _description
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create audit triggers for all relevant tables
CREATE TRIGGER audit_tasks_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

CREATE TRIGGER audit_milestones_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

CREATE TRIGGER audit_stakeholders_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.stakeholders
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

CREATE TRIGGER audit_risk_register_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.risk_register
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

CREATE TRIGGER audit_discussions_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.project_discussions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

CREATE TRIGGER audit_backlog_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.task_backlog
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

CREATE TRIGGER audit_retrospectives_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.retrospectives
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

CREATE TRIGGER audit_capacity_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.team_capacity_iterations
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

-- Add updated_at triggers for new tables
CREATE TRIGGER update_module_permissions_updated_at
  BEFORE UPDATE ON public.module_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();