-- Enhance retrospective tables for better analytics and task conversion tracking

-- Add backlog_task_id to retrospective_action_items to track conversions
ALTER TABLE public.retrospective_action_items 
ADD COLUMN IF NOT EXISTS backlog_task_id uuid REFERENCES public.task_backlog(id);

-- Add enhanced metadata to retrospective_card_votes for user tracking
ALTER TABLE public.retrospective_card_votes 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Create an index for better performance on retrospective analytics queries
CREATE INDEX IF NOT EXISTS idx_retrospective_action_items_backlog_task 
ON public.retrospective_action_items(backlog_task_id) WHERE backlog_task_id IS NOT NULL;

-- Create an index for card votes analytics
CREATE INDEX IF NOT EXISTS idx_retrospective_card_votes_card_user 
ON public.retrospective_card_votes(card_id, user_id);

-- Add a view for enhanced retrospective analytics
CREATE OR REPLACE VIEW public.retrospective_analytics AS
SELECT 
  r.id as retrospective_id,
  r.project_id,
  r.framework,
  r.status,
  r.created_at,
  r.created_by,
  COUNT(DISTINCT rc.id) as total_cards,
  SUM(rc.votes) as total_votes,
  COUNT(DISTINCT rai.id) as total_action_items,
  COUNT(DISTINCT rai.id) FILTER (WHERE rai.backlog_task_id IS NOT NULL) as converted_to_tasks,
  COUNT(DISTINCT rcv.id) as total_card_votes,
  COUNT(DISTINCT rcv.user_id) as unique_voters
FROM public.retrospectives r
LEFT JOIN public.retrospective_columns rcol ON r.id = rcol.retrospective_id
LEFT JOIN public.retrospective_cards rc ON rcol.id = rc.column_id
LEFT JOIN public.retrospective_action_items rai ON r.id = rai.retrospective_id
LEFT JOIN public.retrospective_card_votes rcv ON rc.id = rcv.card_id
GROUP BY r.id, r.project_id, r.framework, r.status, r.created_at, r.created_by;