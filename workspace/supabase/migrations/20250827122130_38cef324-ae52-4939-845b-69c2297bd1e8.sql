-- First, clear any invalid owner_id values in tasks
UPDATE tasks SET owner_id = NULL 
WHERE owner_id IS NOT NULL 
AND owner_id NOT IN (SELECT id FROM stakeholders);

-- Drop the incorrect foreign key constraint
ALTER TABLE tasks DROP CONSTRAINT tasks_owner_id_fkey;

-- Add the correct foreign key constraint to reference stakeholders
ALTER TABLE tasks ADD CONSTRAINT tasks_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES stakeholders(id) ON DELETE SET NULL;