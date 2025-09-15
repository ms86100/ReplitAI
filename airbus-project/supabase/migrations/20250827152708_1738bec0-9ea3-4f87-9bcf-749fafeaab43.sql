-- Clean up corrupted task statuses dynamically
-- Reset any status that looks like a UUID back to 'todo'
UPDATE public.tasks 
SET status = 'todo'
WHERE status ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Ensure all tasks have valid statuses
UPDATE public.tasks 
SET status = 'todo'
WHERE status NOT IN ('todo', 'in_progress', 'in_review', 'blocked', 'completed');