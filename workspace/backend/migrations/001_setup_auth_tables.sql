-- Create auth schema (simulating Supabase auth)
CREATE SCHEMA IF NOT EXISTS auth;

-- Create auth.users table (simulating Supabase auth.users)
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    encrypted_password TEXT NOT NULL,
    email_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required tables exist with proper constraints

-- Update profiles table to ensure foreign key to auth.users
DO $$
BEGIN
    -- Check if foreign key constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_id_fkey' 
        AND table_name = 'profiles'
    ) THEN
        -- Add foreign key constraint
        ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create auth helper functions
CREATE OR REPLACE FUNCTION auth.uid() 
RETURNS UUID 
LANGUAGE sql 
STABLE 
AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid;
$$;

-- Create JWT setting function (for backend compatibility)
CREATE OR REPLACE FUNCTION set_current_user_id(user_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
    SELECT set_config('request.jwt.claims', json_build_object('sub', user_id)::text, true);
$$;

-- Ensure user_roles uses proper enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'project_coordinator', 'team_member');
    END IF;
END $$;

-- Update user_roles table if needed
DO $$
BEGIN
    -- Check if role column is proper enum type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles' 
        AND column_name = 'role' 
        AND data_type = 'text'
    ) THEN
        -- Convert text role to enum
        ALTER TABLE user_roles ALTER COLUMN role TYPE app_role USING role::app_role;
    END IF;
END $$;

-- Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Create trigger to automatically create profile when auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id, 
        NEW.email,
        COALESCE(NEW.email, 'User')
    );
    
    -- Assign default role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
        NEW.id, 
        CASE 
            WHEN NEW.email = 'admin@admin.com' THEN 'admin'::app_role
            ELSE 'project_coordinator'::app_role
        END
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Update existing functions to work with auth schema
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;