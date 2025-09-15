-- Fix RLS policies for retrospective_cards to allow proper card movement and operations

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view cards in their project retrospectives" ON public.retrospective_cards;
DROP POLICY IF EXISTS "Users can create cards in their project retrospectives" ON public.retrospective_cards;
DROP POLICY IF EXISTS "Users can update cards in their project retrospectives" ON public.retrospective_cards;
DROP POLICY IF EXISTS "Users can delete cards in their project retrospectives" ON public.retrospective_cards;

-- Create comprehensive RLS policies for retrospective_cards
CREATE POLICY "Users can view cards in their project retrospectives"
ON public.retrospective_cards FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.retrospective_columns rc
    JOIN public.retrospectives r ON rc.retrospective_id = r.id
    JOIN public.projects p ON r.project_id = p.id
    WHERE rc.id = retrospective_cards.column_id
    AND (
      p.created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.project_members pm 
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.project_roles pr
        WHERE pr.project_id = p.id AND pr.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can create cards in their project retrospectives"
ON public.retrospective_cards FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.retrospective_columns rc
    JOIN public.retrospectives r ON rc.retrospective_id = r.id
    JOIN public.projects p ON r.project_id = p.id
    WHERE rc.id = retrospective_cards.column_id
    AND (
      p.created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.project_members pm 
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.project_roles pr
        WHERE pr.project_id = p.id AND pr.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can update cards in their project retrospectives"
ON public.retrospective_cards FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.retrospective_columns rc
    JOIN public.retrospectives r ON rc.retrospective_id = r.id
    JOIN public.projects p ON r.project_id = p.id
    WHERE rc.id = retrospective_cards.column_id
    AND (
      p.created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.project_members pm 
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.project_roles pr
        WHERE pr.project_id = p.id AND pr.user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.retrospective_columns rc
    JOIN public.retrospectives r ON rc.retrospective_id = r.id
    JOIN public.projects p ON r.project_id = p.id
    WHERE rc.id = retrospective_cards.column_id
    AND (
      p.created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.project_members pm 
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.project_roles pr
        WHERE pr.project_id = p.id AND pr.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can delete cards in their project retrospectives"
ON public.retrospective_cards FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.retrospective_columns rc
    JOIN public.retrospectives r ON rc.retrospective_id = r.id
    JOIN public.projects p ON r.project_id = p.id
    WHERE rc.id = retrospective_cards.column_id
    AND (
      p.created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.project_members pm 
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM public.project_roles pr
        WHERE pr.project_id = p.id AND pr.user_id = auth.uid()
      )
    )
  )
);