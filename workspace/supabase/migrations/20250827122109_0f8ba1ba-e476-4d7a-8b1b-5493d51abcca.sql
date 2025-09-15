-- Drop the incorrect foreign key constraint
ALTER TABLE tasks DROP CONSTRAINT tasks_owner_id_fkey;

-- Add the correct foreign key constraint to reference stakeholders
ALTER TABLE tasks ADD CONSTRAINT tasks_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES stakeholders(id) ON DELETE SET NULL;