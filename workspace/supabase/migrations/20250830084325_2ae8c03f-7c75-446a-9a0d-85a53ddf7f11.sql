-- Create helper functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_project_module_permission(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.module_permissions mp
    WHERE mp.project_id = _project_id AND mp.user_id = _user_id
  );
$$;

-- Replace the projects SELECT policy to remove recursive references
DROP POLICY IF EXISTS "Users can view their accessible projects" ON public.projects;

CREATE POLICY "Users can view their accessible projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR public.is_project_member(auth.uid(), id)
  OR public.has_project_module_permission(auth.uid(), id)
);
