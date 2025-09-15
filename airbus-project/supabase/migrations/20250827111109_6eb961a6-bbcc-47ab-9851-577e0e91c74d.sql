-- Fix security warnings by setting proper search paths for all functions
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_projects_set_department()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.trg_milestones_set_department()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.trg_tasks_set_department()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;$$;

CREATE OR REPLACE FUNCTION public.trg_project_members_set_department()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.user_id);
  END IF;
  RETURN NEW;
END;$$;

-- Fix existing functions that were missing search paths
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
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
$$;