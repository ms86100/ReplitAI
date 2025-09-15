-- Create teams table for team capacity management
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    member_name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    skills TEXT[] DEFAULT '{}',
    work_mode TEXT DEFAULT 'office' CHECK (work_mode IN ('office', 'wfh', 'hybrid')),
    default_availability_percent INTEGER DEFAULT 100 CHECK (default_availability_percent >= 0 AND default_availability_percent <= 100),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create team_capacity_iterations table
CREATE TABLE IF NOT EXISTS team_capacity_iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'iteration' CHECK (type IN ('iteration', 'sprint', 'cycle')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    weeks_count INTEGER NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Create team_capacity_members table
CREATE TABLE IF NOT EXISTS team_capacity_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iteration_id UUID NOT NULL REFERENCES team_capacity_iterations(id) ON DELETE CASCADE,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    working_days INTEGER NOT NULL DEFAULT 5,
    leaves INTEGER DEFAULT 0,
    availability_percent INTEGER DEFAULT 100 CHECK (availability_percent >= 0 AND availability_percent <= 100),
    effective_capacity NUMERIC DEFAULT 0,
    work_mode TEXT DEFAULT 'office' CHECK (work_mode IN ('office', 'wfh', 'hybrid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(iteration_id, team_member_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_project_id ON teams(project_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_capacity_iterations_project_id ON team_capacity_iterations(project_id);
CREATE INDEX IF NOT EXISTS idx_team_capacity_iterations_team_id ON team_capacity_iterations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_capacity_members_iteration_id ON team_capacity_members(iteration_id);
CREATE INDEX IF NOT EXISTS idx_team_capacity_members_team_member_id ON team_capacity_members(team_member_id);

-- Update trigger for teams
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_teams_updated_at();

-- Update trigger for team_members
CREATE TRIGGER trigger_update_team_members_updated_at
    BEFORE UPDATE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_teams_updated_at();

-- Update trigger for team_capacity_iterations
CREATE TRIGGER trigger_update_team_capacity_iterations_updated_at
    BEFORE UPDATE ON team_capacity_iterations
    FOR EACH ROW
    EXECUTE FUNCTION update_teams_updated_at();

-- Update trigger for team_capacity_members
CREATE TRIGGER trigger_update_team_capacity_members_updated_at
    BEFORE UPDATE ON team_capacity_members
    FOR EACH ROW
    EXECUTE FUNCTION update_teams_updated_at();

-- Function to calculate effective capacity
CREATE OR REPLACE FUNCTION calculate_effective_capacity(
    working_days INTEGER,
    leaves INTEGER,
    availability_percent INTEGER,
    work_mode TEXT DEFAULT 'office',
    office_weight NUMERIC DEFAULT 1.0,
    wfh_weight NUMERIC DEFAULT 0.9,
    hybrid_weight NUMERIC DEFAULT 0.95
) RETURNS NUMERIC AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-calculate effective capacity
CREATE OR REPLACE FUNCTION calculate_member_effective_capacity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.effective_capacity := calculate_effective_capacity(
        NEW.working_days,
        NEW.leaves,
        NEW.availability_percent,
        NEW.work_mode
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_effective_capacity
    BEFORE INSERT OR UPDATE ON team_capacity_members
    FOR EACH ROW
    EXECUTE FUNCTION calculate_member_effective_capacity();