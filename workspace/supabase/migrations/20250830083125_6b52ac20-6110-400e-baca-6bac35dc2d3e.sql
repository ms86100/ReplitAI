-- Clean up orphaned retrospective action items and add the foreign key constraint
DELETE FROM retrospective_action_items 
WHERE retrospective_id NOT IN (SELECT id FROM retrospectives);

-- Now add the foreign key constraint
ALTER TABLE retrospective_action_items 
ADD CONSTRAINT fk_retrospective_action_items_retrospective_id 
FOREIGN KEY (retrospective_id) REFERENCES retrospectives(id) ON DELETE CASCADE;