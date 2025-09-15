-- Create project_discussions table
CREATE TABLE public.project_discussions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  meeting_title TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  summary_notes TEXT,
  attendees JSONB DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create discussion_action_items table
CREATE TABLE public.discussion_action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discussion_id UUID NOT NULL,
  task_description TEXT NOT NULL,
  owner_id UUID,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create discussion_change_log table
CREATE TABLE public.discussion_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discussion_id UUID,
  action_item_id UUID,
  change_type TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.project_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_change_log ENABLE ROW LEVEL SECURITY;

-- Create policies for project_discussions
CREATE POLICY "Users can view discussions in their projects" 
ON public.project_discussions 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_discussions.project_id) AND ((p.created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = p.id) AND (pm.user_id = auth.uid()))))))));

CREATE POLICY "Users can create discussions in their projects" 
ON public.project_discussions 
FOR INSERT 
WITH CHECK (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_discussions.project_id) AND ((p.created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = p.id) AND (pm.user_id = auth.uid()))))))) AND (created_by = auth.uid()));

CREATE POLICY "Users can update discussions in their projects" 
ON public.project_discussions 
FOR UPDATE 
USING (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_discussions.project_id) AND ((p.created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = p.id) AND (pm.user_id = auth.uid()))))))));

CREATE POLICY "Users can delete discussions in their projects" 
ON public.project_discussions 
FOR DELETE 
USING (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_discussions.project_id) AND ((p.created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = p.id) AND (pm.user_id = auth.uid()))))))));

-- Create policies for discussion_action_items
CREATE POLICY "Users can view action items in their project discussions" 
ON public.discussion_action_items 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM project_discussions pd
   JOIN projects p ON p.id = pd.project_id
  WHERE ((pd.id = discussion_action_items.discussion_id) AND ((p.created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = p.id) AND (pm.user_id = auth.uid()))))))));

CREATE POLICY "Users can create action items in their project discussions" 
ON public.discussion_action_items 
FOR INSERT 
WITH CHECK (EXISTS ( SELECT 1
   FROM project_discussions pd
   JOIN projects p ON p.id = pd.project_id
  WHERE ((pd.id = discussion_action_items.discussion_id) AND ((p.created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = p.id) AND (pm.user_id = auth.uid()))))))) AND (created_by = auth.uid()));

CREATE POLICY "Users can update action items in their project discussions" 
ON public.discussion_action_items 
FOR UPDATE 
USING (EXISTS ( SELECT 1
   FROM project_discussions pd
   JOIN projects p ON p.id = pd.project_id
  WHERE ((pd.id = discussion_action_items.discussion_id) AND ((p.created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = p.id) AND (pm.user_id = auth.uid()))))))));

CREATE POLICY "Users can delete action items in their project discussions" 
ON public.discussion_action_items 
FOR DELETE 
USING (EXISTS ( SELECT 1
   FROM project_discussions pd
   JOIN projects p ON p.id = pd.project_id
  WHERE ((pd.id = discussion_action_items.discussion_id) AND ((p.created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = p.id) AND (pm.user_id = auth.uid()))))))));

-- Create policies for discussion_change_log
CREATE POLICY "Users can view change log in their project discussions" 
ON public.discussion_change_log 
FOR SELECT 
USING (EXISTS ( SELECT 1
   FROM project_discussions pd
   JOIN projects p ON p.id = pd.project_id
  WHERE ((pd.id = discussion_change_log.discussion_id) AND ((p.created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = p.id) AND (pm.user_id = auth.uid()))))))));

CREATE POLICY "Users can create change log entries in their project discussions" 
ON public.discussion_change_log 
FOR INSERT 
WITH CHECK (EXISTS ( SELECT 1
   FROM project_discussions pd
   JOIN projects p ON p.id = pd.project_id
  WHERE ((pd.id = discussion_change_log.discussion_id) AND ((p.created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = p.id) AND (pm.user_id = auth.uid()))))))) AND (changed_by = auth.uid()));

-- Add foreign key references
ALTER TABLE public.discussion_action_items 
ADD CONSTRAINT discussion_action_items_discussion_id_fkey 
FOREIGN KEY (discussion_id) REFERENCES public.project_discussions(id) ON DELETE CASCADE;

-- Add triggers for updated_at columns
CREATE TRIGGER update_project_discussions_updated_at
BEFORE UPDATE ON public.project_discussions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discussion_action_items_updated_at
BEFORE UPDATE ON public.discussion_action_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger function for change logging
CREATE OR REPLACE FUNCTION public.log_discussion_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log discussion changes
  IF TG_TABLE_NAME = 'project_discussions' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.discussion_change_log (
        discussion_id, change_type, field_name, new_value, changed_by
      ) VALUES (
        NEW.id, 'created', 'discussion', 'Discussion created', auth.uid()
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.meeting_title IS DISTINCT FROM NEW.meeting_title THEN
        INSERT INTO public.discussion_change_log (
          discussion_id, change_type, field_name, old_value, new_value, changed_by
        ) VALUES (
          NEW.id, 'updated', 'meeting_title', OLD.meeting_title, NEW.meeting_title, auth.uid()
        );
      END IF;
      IF OLD.summary_notes IS DISTINCT FROM NEW.summary_notes THEN
        INSERT INTO public.discussion_change_log (
          discussion_id, change_type, field_name, old_value, new_value, changed_by
        ) VALUES (
          NEW.id, 'updated', 'summary_notes', OLD.summary_notes, NEW.summary_notes, auth.uid()
        );
      END IF;
    END IF;
  -- Log action item changes
  ELSIF TG_TABLE_NAME = 'discussion_action_items' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.discussion_change_log (
        discussion_id, action_item_id, change_type, field_name, new_value, changed_by
      ) VALUES (
        NEW.discussion_id, NEW.id, 'created', 'action_item', 'Action item created', auth.uid()
      );
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.discussion_change_log (
          discussion_id, action_item_id, change_type, field_name, old_value, new_value, changed_by
        ) VALUES (
          NEW.discussion_id, NEW.id, 'updated', 'status', OLD.status, NEW.status, auth.uid()
        );
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO public.discussion_change_log (
        discussion_id, action_item_id, change_type, field_name, old_value, changed_by
      ) VALUES (
        OLD.discussion_id, OLD.id, 'deleted', 'action_item', 'Action item deleted', auth.uid()
      );
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create triggers for change logging
CREATE TRIGGER log_discussion_changes_trigger
AFTER INSERT OR UPDATE ON public.project_discussions
FOR EACH ROW
EXECUTE FUNCTION public.log_discussion_changes();

CREATE TRIGGER log_action_item_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.discussion_action_items
FOR EACH ROW
EXECUTE FUNCTION public.log_discussion_changes();