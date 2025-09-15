-- Replace update policies for retrospective_cards with proper WITH CHECK
DROP POLICY IF EXISTS "Project members can update cards in retrospectives" ON retrospective_cards;
DROP POLICY IF EXISTS "Users can update cards in their retrospectives" ON retrospective_cards;

CREATE POLICY "Members can update votes and move cards"
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
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
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
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
      )
  )
);