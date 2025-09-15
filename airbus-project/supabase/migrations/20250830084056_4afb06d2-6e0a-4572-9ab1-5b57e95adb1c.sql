-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;

-- Create a more restrictive policy that only allows users to see:
-- 1. Projects they created
-- 2. Projects they are members of
-- 3. Projects they have module permissions for
CREATE POLICY "Users can view their accessible projects" 
ON public.projects 
FOR SELECT 
TO authenticated
USING (
  -- User is the project creator
  created_by = auth.uid() 
  OR 
  -- User is an admin
  has_role(auth.uid(), 'admin'::app_role)
  OR
  -- User is a project member
  EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = projects.id 
    AND pm.user_id = auth.uid()
  )
  OR
  -- User has module permissions for this project
  EXISTS (
    SELECT 1 FROM public.module_permissions mp
    WHERE mp.project_id = projects.id 
    AND mp.user_id = auth.uid()
  )
);