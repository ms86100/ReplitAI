-- Fix the retrospective_action_items relationship by adding the missing foreign key constraint
ALTER TABLE retrospective_action_items 
ADD CONSTRAINT fk_retrospective_action_items_retrospective_id 
FOREIGN KEY (retrospective_id) REFERENCES retrospectives(id) ON DELETE CASCADE;