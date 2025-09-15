-- Add table to track individual votes on retrospective cards
CREATE TABLE public.retrospective_card_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.retrospective_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.retrospective_card_votes ENABLE ROW LEVEL SECURITY;

-- Create policies for card votes
CREATE POLICY "Users can view votes in their retrospectives" 
ON public.retrospective_card_votes 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM retrospective_cards rc
    JOIN retrospective_columns rcol ON rcol.id = rc.column_id
    JOIN retrospectives r ON r.id = rcol.retrospective_id
    JOIN projects p ON p.id = r.project_id
    WHERE rc.id = retrospective_card_votes.card_id
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  )
);

CREATE POLICY "Users can vote in their retrospectives" 
ON public.retrospective_card_votes 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM retrospective_cards rc
    JOIN retrospective_columns rcol ON rcol.id = rc.column_id
    JOIN retrospectives r ON r.id = rcol.retrospective_id
    JOIN projects p ON p.id = r.project_id
    WHERE rc.id = retrospective_card_votes.card_id
    AND (p.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR 
         EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  )
);

-- Add unique constraint to prevent duplicate votes
CREATE UNIQUE INDEX idx_retrospective_card_votes_unique ON public.retrospective_card_votes(card_id, user_id);

-- Update retrospective_action_items to track conversion to tasks
ALTER TABLE public.retrospective_action_items 
ADD COLUMN converted_to_task BOOLEAN DEFAULT FALSE,
ADD COLUMN task_id UUID REFERENCES public.task_backlog(id) ON DELETE SET NULL;