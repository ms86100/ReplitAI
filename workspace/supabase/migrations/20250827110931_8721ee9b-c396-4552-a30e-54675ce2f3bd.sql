-- Add department_id to projects table
ALTER TABLE public.projects 
ADD COLUMN department_id uuid REFERENCES public.departments(id);

-- Add department_id to stakeholders table  
ALTER TABLE public.stakeholders
ADD COLUMN department_id uuid REFERENCES public.departments(id);

-- Add department_id to project_statuses table
ALTER TABLE public.project_statuses
ADD COLUMN department_id uuid REFERENCES public.departments(id);

-- Create index for better performance on department queries
CREATE INDEX idx_projects_department_id ON public.projects(department_id);
CREATE INDEX idx_stakeholders_department_id ON public.stakeholders(department_id);
CREATE INDEX idx_project_statuses_department_id ON public.project_statuses(department_id);

-- Update RLS policies to consider department access for projects
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
CREATE POLICY "Users can view projects in their department or if admin" 
ON public.projects 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  department_id IN (
    SELECT department_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  ) OR
  department_id IS NULL  -- Allow viewing projects without department
);

-- Update insert policy for projects
DROP POLICY IF EXISTS "Authenticated users can create projects" ON public.projects;
CREATE POLICY "Users can create projects for their department" 
ON public.projects 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by AND (
    department_id IN (
      SELECT department_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    ) OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Update RLS policies for stakeholders
CREATE POLICY "Users can view stakeholders in their department" 
ON public.stakeholders 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  department_id IN (
    SELECT department_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  ) OR
  department_id IS NULL
);

CREATE POLICY "Users can create stakeholders for their department" 
ON public.stakeholders 
FOR INSERT 
WITH CHECK (
  department_id IN (
    SELECT department_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  ) OR
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update stakeholders in their department" 
ON public.stakeholders 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  department_id IN (
    SELECT department_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete stakeholders in their department" 
ON public.stakeholders 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  department_id IN (
    SELECT department_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Update RLS policies for project_statuses
CREATE POLICY "Users can view statuses in their department" 
ON public.project_statuses 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  department_id IN (
    SELECT department_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  ) OR
  department_id IS NULL
);

CREATE POLICY "Users can create statuses for their department" 
ON public.project_statuses 
FOR INSERT 
WITH CHECK (
  department_id IN (
    SELECT department_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  ) OR
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update statuses in their department" 
ON public.project_statuses 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  department_id IN (
    SELECT department_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete statuses in their department" 
ON public.project_statuses 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  department_id IN (
    SELECT department_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);