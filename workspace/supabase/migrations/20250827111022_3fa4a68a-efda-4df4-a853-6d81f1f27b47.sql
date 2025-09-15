-- 1) Add department_id to existing tables
ALTER TABLE public.projects        ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);
ALTER TABLE public.milestones      ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);
ALTER TABLE public.tasks           ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);

-- 2) Backfill existing rows from profiles where possible
UPDATE public.projects p
SET department_id = pr.department_id
FROM public.profiles pr
WHERE p.department_id IS NULL AND pr.id = p.created_by;

UPDATE public.milestones m
SET department_id = pr.department_id
FROM public.profiles pr
WHERE m.department_id IS NULL AND pr.id = m.created_by;

UPDATE public.tasks t
SET department_id = pr.department_id
FROM public.profiles pr
WHERE t.department_id IS NULL AND pr.id = t.created_by;

UPDATE public.project_members pm
SET department_id = pr.department_id
FROM public.profiles pr
WHERE pm.department_id IS NULL AND pr.id = pm.user_id;

-- 3) Helper function to get a user's department
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT department_id FROM public.profiles WHERE id = _user_id;
$$;

-- 4) Triggers to auto-populate department_id on INSERT
-- Projects: use created_by
CREATE OR REPLACE FUNCTION public.trg_projects_set_department()
RETURNS trigger AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_set_department ON public.projects;
CREATE TRIGGER trg_projects_set_department
BEFORE INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.trg_projects_set_department();

-- Milestones: use created_by
CREATE OR REPLACE FUNCTION public.trg_milestones_set_department()
RETURNS trigger AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_milestones_set_department ON public.milestones;
CREATE TRIGGER trg_milestones_set_department
BEFORE INSERT ON public.milestones
FOR EACH ROW EXECUTE FUNCTION public.trg_milestones_set_department();

-- Tasks: use created_by
CREATE OR REPLACE FUNCTION public.trg_tasks_set_department()
RETURNS trigger AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_set_department ON public.tasks;
CREATE TRIGGER trg_tasks_set_department
BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_set_department();

-- Project members: use user_id
CREATE OR REPLACE FUNCTION public.trg_project_members_set_department()
RETURNS trigger AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.user_id);
  END IF;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_members_set_department ON public.project_members;
CREATE TRIGGER trg_project_members_set_department
BEFORE INSERT ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.trg_project_members_set_department();

-- 5) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_department_id        ON public.projects(department_id);
CREATE INDEX IF NOT EXISTS idx_milestones_department_id      ON public.milestones(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_department_id           ON public.tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_project_members_department_id ON public.project_members(department_id);