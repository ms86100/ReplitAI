-- Clean up orphaned columns first, then add foreign keys
-- This will fix the nested select issue

-- Step 1: Delete orphaned retrospective_columns (columns without parent retrospectives)
DELETE FROM public.retrospective_columns rc
WHERE NOT EXISTS (
  SELECT 1 FROM public.retrospectives r WHERE r.id = rc.retrospective_id
);

-- Step 2: Delete orphaned retrospective_cards (cards without parent columns)  
DELETE FROM public.retrospective_cards c
WHERE NOT EXISTS (
  SELECT 1 FROM public.retrospective_columns rc WHERE rc.id = c.column_id
);

-- Step 3: Add foreign key constraints to enable PostgREST nested selects
ALTER TABLE public.retrospective_columns 
ADD CONSTRAINT fk_retrospective_columns_retrospective_id 
FOREIGN KEY (retrospective_id) REFERENCES public.retrospectives(id) ON DELETE CASCADE;

ALTER TABLE public.retrospective_cards 
ADD CONSTRAINT fk_retrospective_cards_column_id 
FOREIGN KEY (column_id) REFERENCES public.retrospective_columns(id) ON DELETE CASCADE;