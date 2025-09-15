-- Fix RLS policies for retrospective_cards to allow proper card creation and management

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can create cards in their retrospectives" ON public.retrospective_cards;
DROP POLICY IF EXISTS "Members can update votes and move cards" ON public.retrospective_cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON public.retrospective_cards;
DROP POLICY IF EXISTS "Users can view cards in their retrospectives" ON public.retrospective_cards;

-- Create new, more permissive policies for retrospective_cards
CREATE POLICY "Users can view cards in accessible retrospectives" ON public.retrospective_cards
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.retrospective_columns rc
    JOIN public.retrospectives r ON r.id = rc.retrospective_id
    JOIN public.projects p ON p.id = r.project_id
    WHERE rc.id = retrospective_cards.column_id
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can create cards in accessible retrospectives" ON public.retrospective_cards
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.retrospective_columns rc
    JOIN public.retrospectives r ON r.id = rc.retrospective_id
    JOIN public.projects p ON p.id = r.project_id
    WHERE rc.id = retrospective_cards.column_id
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update cards in accessible retrospectives" ON public.retrospective_cards
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.retrospective_columns rc
    JOIN public.retrospectives r ON r.id = rc.retrospective_id
    JOIN public.projects p ON p.id = r.project_id
    WHERE rc.id = retrospective_cards.column_id
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.retrospective_columns rc
    JOIN public.retrospectives r ON r.id = rc.retrospective_id
    JOIN public.projects p ON p.id = r.project_id
    WHERE rc.id = retrospective_cards.column_id
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role) OR
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can delete their own cards or project owners can delete any card" ON public.retrospective_cards
FOR DELETE USING (
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.retrospective_columns rc
    JOIN public.retrospectives r ON r.id = rc.retrospective_id
    JOIN public.projects p ON p.id = r.project_id
    WHERE rc.id = retrospective_cards.column_id
    AND (
      p.created_by = auth.uid() OR
      has_role(auth.uid(), 'admin'::app_role)
    )
  )
);