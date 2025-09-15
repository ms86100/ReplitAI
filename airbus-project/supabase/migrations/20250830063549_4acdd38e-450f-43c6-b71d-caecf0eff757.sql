-- Fix RLS policies for retrospective cards to allow all project members to vote and move cards

-- Drop existing policies that are too restrictive
DROP POLICY IF EXISTS "Users can update cards in their retrospectives" ON retrospective_cards;

-- Create new update policy that allows project members to update any card in their project retrospectives
CREATE POLICY "Project members can update cards in retrospectives"
ON retrospective_cards 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM retrospective_columns rc
    JOIN retrospectives r ON r.id = rc.retrospective_id
    JOIN projects p ON p.id = r.project_id
    WHERE rc.id = retrospective_cards.column_id
    AND (
      p.created_by = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 
        FROM project_members pm 
        WHERE pm.project_id = p.id 
        AND pm.user_id = auth.uid()
      )
    )
  )
);