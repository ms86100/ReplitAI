-- Create retrospectives table
CREATE TABLE public.retrospectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iteration_id UUID NOT NULL,
  framework TEXT NOT NULL DEFAULT 'Classic',
  project_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  department_id UUID,
  status TEXT NOT NULL DEFAULT 'active'
);

-- Create retrospective columns table
CREATE TABLE public.retrospective_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  retrospective_id UUID NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  column_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create retrospective cards table
CREATE TABLE public.retrospective_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id UUID NOT NULL,
  text TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  card_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create retrospective action items table
CREATE TABLE public.retrospective_action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  retrospective_id UUID NOT NULL,
  from_card_id UUID,
  what_task TEXT NOT NULL,
  when_sprint TEXT,
  who_responsible TEXT,
  how_approach TEXT,
  backlog_ref_id TEXT,
  backlog_status TEXT DEFAULT 'Open',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retrospectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrospective_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrospective_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrospective_action_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for retrospectives
CREATE POLICY "Users can create retrospectives in their projects" 
ON public.retrospectives FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = retrospectives.project_id 
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  ) AND created_by = auth.uid()
);

CREATE POLICY "Users can view retrospectives in their projects" 
ON public.retrospectives FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = retrospectives.project_id 
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  )
);

CREATE POLICY "Users can update retrospectives in their projects" 
ON public.retrospectives FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = retrospectives.project_id 
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  )
);

CREATE POLICY "Users can delete retrospectives in their projects" 
ON public.retrospectives FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = retrospectives.project_id 
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  )
);

-- RLS Policies for retrospective_columns
CREATE POLICY "Users can manage columns in their retrospectives" 
ON public.retrospective_columns FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM retrospectives r 
    JOIN projects p ON p.id = r.project_id 
    WHERE r.id = retrospective_columns.retrospective_id 
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  )
);

-- RLS Policies for retrospective_cards
CREATE POLICY "Users can create cards in their retrospectives" 
ON public.retrospective_cards FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM retrospective_columns rc 
    JOIN retrospectives r ON r.id = rc.retrospective_id 
    JOIN projects p ON p.id = r.project_id 
    WHERE rc.id = retrospective_cards.column_id 
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  ) AND created_by = auth.uid()
);

CREATE POLICY "Users can view cards in their retrospectives" 
ON public.retrospective_cards FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM retrospective_columns rc 
    JOIN retrospectives r ON r.id = rc.retrospective_id 
    JOIN projects p ON p.id = r.project_id 
    WHERE rc.id = retrospective_cards.column_id 
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  )
);

CREATE POLICY "Users can update cards in their retrospectives" 
ON public.retrospective_cards FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM retrospective_columns rc 
    JOIN retrospectives r ON r.id = rc.retrospective_id 
    JOIN projects p ON p.id = r.project_id 
    WHERE rc.id = retrospective_cards.column_id 
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  )
);

CREATE POLICY "Users can delete their own cards" 
ON public.retrospective_cards FOR DELETE 
USING (
  created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM retrospective_columns rc 
    JOIN retrospectives r ON r.id = rc.retrospective_id 
    JOIN projects p ON p.id = r.project_id 
    WHERE rc.id = retrospective_cards.column_id 
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- RLS Policies for retrospective_action_items
CREATE POLICY "Users can manage action items in their retrospectives" 
ON public.retrospective_action_items FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM retrospectives r 
    JOIN projects p ON p.id = r.project_id 
    WHERE r.id = retrospective_action_items.retrospective_id 
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM retrospectives r 
    JOIN projects p ON p.id = r.project_id 
    WHERE r.id = retrospective_action_items.retrospective_id 
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  ) AND created_by = auth.uid()
);

-- Add triggers for department_id
CREATE OR REPLACE FUNCTION public.trg_retrospectives_set_department()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.department_id IS NULL THEN
    NEW.department_id := public.get_user_department(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER retrospectives_set_department_trigger
  BEFORE INSERT ON public.retrospectives
  FOR EACH ROW EXECUTE FUNCTION public.trg_retrospectives_set_department();

-- Add update triggers
CREATE TRIGGER update_retrospectives_updated_at
  BEFORE UPDATE ON public.retrospectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_retrospective_columns_updated_at
  BEFORE UPDATE ON public.retrospective_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_retrospective_cards_updated_at
  BEFORE UPDATE ON public.retrospective_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_retrospective_action_items_updated_at
  BEFORE UPDATE ON public.retrospective_action_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();