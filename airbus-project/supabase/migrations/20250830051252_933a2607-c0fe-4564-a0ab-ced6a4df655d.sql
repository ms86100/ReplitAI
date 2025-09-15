-- Fix function search paths by adding SECURITY DEFINER SET search_path = 'public'
-- for functions that need it

-- Fix trg_risk_register_set_department function
CREATE OR REPLACE FUNCTION public.trg_risk_register_set_department()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix trg_task_backlog_set_department function  
CREATE OR REPLACE FUNCTION public.trg_task_backlog_set_department()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix trg_projects_set_department function
CREATE OR REPLACE FUNCTION public.trg_projects_set_department()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix trg_milestones_set_department function
CREATE OR REPLACE FUNCTION public.trg_milestones_set_department()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix trg_tasks_set_department function
CREATE OR REPLACE FUNCTION public.trg_tasks_set_department()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix trg_project_members_set_department function
CREATE OR REPLACE FUNCTION public.trg_project_members_set_department()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$function$;