-- Fix the module permissions system to properly check admin role
CREATE OR REPLACE FUNCTION public.has_module_permission_with_admin(_user_id uuid, _project_id uuid, _module module_name, _required_access access_level)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Project owner has full access
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.created_by = _user_id
  )
  OR
  -- Admin has full access  
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'admin'
  )
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

GRANT EXECUTE ON FUNCTION public.has_module_permission_with_admin(uuid, uuid, module_name, access_level) TO authenticated;