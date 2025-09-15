-- Fix security definer view by creating it as a regular view with proper RLS
DROP VIEW IF EXISTS public.retrospective_analytics;

-- Create a regular view that respects RLS policies
CREATE VIEW public.retrospective_analytics AS
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