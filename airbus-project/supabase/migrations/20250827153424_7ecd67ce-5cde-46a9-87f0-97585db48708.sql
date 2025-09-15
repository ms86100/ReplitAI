-- Clean up corrupted status history entries
DELETE FROM public.task_status_history 
WHERE old_status ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR new_status ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Also clean up any invalid statuses that are not in our valid list
DELETE FROM public.task_status_history 
WHERE new_status NOT IN ('todo', 'in_progress', 'in_review', 'blocked', 'completed')
   OR (old_status IS NOT NULL AND old_status NOT IN ('todo', 'in_progress', 'in_review', 'blocked', 'completed'));