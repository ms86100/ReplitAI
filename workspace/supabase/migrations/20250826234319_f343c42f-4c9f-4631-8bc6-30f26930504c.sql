-- Create departments table
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Create policies for departments
CREATE POLICY "Everyone can view departments" 
ON public.departments 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage departments" 
ON public.departments 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add department_id to profiles table
ALTER TABLE public.profiles 
ADD COLUMN department_id uuid REFERENCES public.departments(id);

-- Create trigger for department updated_at
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();