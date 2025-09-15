-- Sync PostgreSQL localhost database with Supabase schema
-- This migration creates all necessary tables and structures to match Supabase

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types (enums) to match Supabase
DO $$
BEGIN
    -- Create app_role enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'project_coordinator', 'stakeholder');
    END IF;
    
    -- Create module_name enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_name') THEN
        CREATE TYPE module_name AS ENUM ('roadmap', 'tasks_milestones', 'stakeholders', 'risk_register', 'discussions', 'task_backlog', 'retrospectives', 'team_capacity');
    END IF;
    
    -- Create access_level enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_level') THEN
        CREATE TYPE access_level AS ENUM ('read', 'write');
    END IF;
END$$;

-- Create auth namespace and helper functions for compatibility
CREATE SCHEMA IF NOT EXISTS auth;

-- Mock auth.uid() function for localhost compatibility
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
BEGIN
    -- Return the current user ID from the request context
    RETURN COALESCE(
        current_setting('request.jwt.claim.sub', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to set current user ID in request context
CREATE OR REPLACE FUNCTION public.set_current_user_id(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
begin
  perform set_config('request.jwt.claim.sub', _user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

-- Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planning',
    priority TEXT DEFAULT 'medium',
    start_date DATE,
    end_date DATE,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_members table
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    department_id UUID REFERENCES public.departments(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Create module_permissions table
CREATE TABLE IF NOT EXISTS public.module_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    module module_name NOT NULL,
    access_level access_level DEFAULT 'read',
    granted_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id, module)
);

-- Create team_capacity_iterations table
CREATE TABLE IF NOT EXISTS public.team_capacity_iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    iteration_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    working_days INTEGER NOT NULL,
    committed_story_points INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create team_capacity_members table
CREATE TABLE IF NOT EXISTS public.team_capacity_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iteration_id UUID NOT NULL REFERENCES public.team_capacity_iterations(id) ON DELETE CASCADE,
    stakeholder_id UUID,
    team_id UUID,
    member_name TEXT NOT NULL,
    role TEXT NOT NULL,
    work_mode TEXT NOT NULL,
    leaves INTEGER DEFAULT 0,
    availability_percent INTEGER DEFAULT 100,
    effective_capacity_days NUMERIC DEFAULT 0,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stakeholders table
CREATE TABLE IF NOT EXISTS public.stakeholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    department TEXT,
    influence_level TEXT,
    raci TEXT,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create milestones table
CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'planning',
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    due_date DATE,
    owner_id UUID REFERENCES public.profiles(id),
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create risk_register table
CREATE TABLE IF NOT EXISTS public.risk_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    risk_code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    cause TEXT,
    consequence TEXT,
    owner TEXT,
    likelihood INTEGER,
    impact INTEGER,
    risk_score INTEGER,
    response_strategy TEXT,
    mitigation_plan TEXT[],
    contingency_plan TEXT,
    status TEXT DEFAULT 'open',
    identified_date DATE,
    last_updated DATE,
    next_review_date DATE,
    residual_likelihood INTEGER,
    residual_impact INTEGER,
    residual_risk_score INTEGER,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_backlog table
CREATE TABLE IF NOT EXISTS public.task_backlog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'backlog',
    owner_id UUID REFERENCES public.profiles(id),
    target_date DATE,
    source_type TEXT DEFAULT 'manual',
    source_id UUID,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create retrospectives table
CREATE TABLE IF NOT EXISTS public.retrospectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    iteration_id UUID NOT NULL,
    framework TEXT DEFAULT 'Classic',
    status TEXT DEFAULT 'active',
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    department_id UUID REFERENCES public.departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create retrospective_columns table
CREATE TABLE IF NOT EXISTS public.retrospective_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retrospective_id UUID NOT NULL REFERENCES public.retrospectives(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subtitle TEXT,
    column_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create retrospective_cards table
CREATE TABLE IF NOT EXISTS public.retrospective_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    column_id UUID NOT NULL REFERENCES public.retrospective_columns(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    card_order INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create retrospective_action_items table
CREATE TABLE IF NOT EXISTS public.retrospective_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    retrospective_id UUID NOT NULL REFERENCES public.retrospectives(id) ON DELETE CASCADE,
    from_card_id UUID REFERENCES public.retrospective_cards(id),
    what_task TEXT NOT NULL,
    how_approach TEXT,
    who_responsible TEXT,
    when_sprint TEXT,
    converted_to_task BOOLEAN DEFAULT FALSE,
    task_id UUID REFERENCES public.tasks(id),
    backlog_task_id UUID REFERENCES public.task_backlog(id),
    backlog_ref_id TEXT,
    backlog_status TEXT DEFAULT 'Open',
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_discussions table
CREATE TABLE IF NOT EXISTS public.project_discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    meeting_title TEXT NOT NULL,
    meeting_date DATE NOT NULL,
    attendees JSONB DEFAULT '[]',
    summary_notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create discussion_action_items table
CREATE TABLE IF NOT EXISTS public.discussion_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discussion_id UUID NOT NULL REFERENCES public.project_discussions(id) ON DELETE CASCADE,
    task_description TEXT NOT NULL,
    owner_id UUID REFERENCES public.profiles(id),
    target_date DATE,
    status TEXT DEFAULT 'open',
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    module module_name NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_status_history table
CREATE TABLE IF NOT EXISTS public.task_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.profiles(id),
    notes TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create helper functions
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.profiles WHERE id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Create capacity calculation function
CREATE OR REPLACE FUNCTION public.calculate_effective_capacity(
    working_days integer, 
    leaves integer, 
    availability_percent integer, 
    work_mode text, 
    office_weight numeric DEFAULT 1.0, 
    wfh_weight numeric DEFAULT 0.9, 
    hybrid_weight numeric DEFAULT 0.95
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mode_weight NUMERIC;
BEGIN
  -- Get the weight based on work mode
  CASE work_mode
    WHEN 'office' THEN mode_weight := office_weight;
    WHEN 'wfh' THEN mode_weight := wfh_weight;
    WHEN 'hybrid' THEN mode_weight := hybrid_weight;
    ELSE mode_weight := 1.0;
  END CASE;
  
  -- Calculate effective capacity: (working_days - leaves) * (availability_percent/100) * mode_weight
  RETURN (working_days - leaves) * (availability_percent::NUMERIC / 100.0) * mode_weight;
END;
$$;

-- Create update_updated_at function for triggers
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

-- Create triggers for automatic updated_at updates
DO $$
BEGIN
    -- Drop existing triggers if they exist and create new ones
    DROP TRIGGER IF EXISTS update_departments_updated_at ON public.departments;
    CREATE TRIGGER update_departments_updated_at
        BEFORE UPDATE ON public.departments
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
    CREATE TRIGGER update_profiles_updated_at
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
    CREATE TRIGGER update_projects_updated_at
        BEFORE UPDATE ON public.projects
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_module_permissions_updated_at ON public.module_permissions;
    CREATE TRIGGER update_module_permissions_updated_at
        BEFORE UPDATE ON public.module_permissions
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_team_capacity_iterations_updated_at ON public.team_capacity_iterations;
    CREATE TRIGGER update_team_capacity_iterations_updated_at
        BEFORE UPDATE ON public.team_capacity_iterations
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_team_capacity_members_updated_at ON public.team_capacity_members;
    CREATE TRIGGER update_team_capacity_members_updated_at
        BEFORE UPDATE ON public.team_capacity_members
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_stakeholders_updated_at ON public.stakeholders;
    CREATE TRIGGER update_stakeholders_updated_at
        BEFORE UPDATE ON public.stakeholders
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_milestones_updated_at ON public.milestones;
    CREATE TRIGGER update_milestones_updated_at
        BEFORE UPDATE ON public.milestones
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
    CREATE TRIGGER update_tasks_updated_at
        BEFORE UPDATE ON public.tasks
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_risk_register_updated_at ON public.risk_register;
    CREATE TRIGGER update_risk_register_updated_at
        BEFORE UPDATE ON public.risk_register
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_task_backlog_updated_at ON public.task_backlog;
    CREATE TRIGGER update_task_backlog_updated_at
        BEFORE UPDATE ON public.task_backlog
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_retrospectives_updated_at ON public.retrospectives;
    CREATE TRIGGER update_retrospectives_updated_at
        BEFORE UPDATE ON public.retrospectives
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_retrospective_columns_updated_at ON public.retrospective_columns;
    CREATE TRIGGER update_retrospective_columns_updated_at
        BEFORE UPDATE ON public.retrospective_columns
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_retrospective_cards_updated_at ON public.retrospective_cards;
    CREATE TRIGGER update_retrospective_cards_updated_at
        BEFORE UPDATE ON public.retrospective_cards
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_retrospective_action_items_updated_at ON public.retrospective_action_items;
    CREATE TRIGGER update_retrospective_action_items_updated_at
        BEFORE UPDATE ON public.retrospective_action_items
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_project_discussions_updated_at ON public.project_discussions;
    CREATE TRIGGER update_project_discussions_updated_at
        BEFORE UPDATE ON public.project_discussions
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_discussion_action_items_updated_at ON public.discussion_action_items;
    CREATE TRIGGER update_discussion_action_items_updated_at
        BEFORE UPDATE ON public.discussion_action_items
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
END$$;

-- Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_capacity_iterations_project_id ON public.team_capacity_iterations(project_id);
CREATE INDEX IF NOT EXISTS idx_team_capacity_members_iteration_id ON public.team_capacity_members(iteration_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_module_permissions_project_user ON public.module_permissions(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Insert default admin user if doesn't exist
INSERT INTO public.profiles (id, email, full_name) 
VALUES ('00000000-0000-0000-0000-000000000000', 'admin@admin.com', 'System Admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Make sure all tables exist and have correct structure
SELECT 'Migration completed successfully. All tables and structures created.' as status;