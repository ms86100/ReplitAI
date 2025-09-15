-- Step 1: Clean up orphaned data causing FK constraint failures
-- Delete cards whose column_id does not exist
DELETE FROM public.retrospective_cards c
WHERE NOT EXISTS (
  SELECT 1 FROM public.retrospective_columns rc WHERE rc.id = c.column_id
);

-- Delete columns whose retrospective_id does not exist
DELETE FROM public.retrospective_columns rc
WHERE NOT EXISTS (
  SELECT 1 FROM public.retrospectives r WHERE r.id = rc.retrospective_id
);

-- Step 2: Add required foreign keys to support PostgREST nested selects
ALTER TABLE public.retrospective_columns 
ADD CONSTRAINT fk_retrospective_columns_retrospective_id 
FOREIGN KEY (retrospective_id) REFERENCES public.retrospectives(id) ON DELETE CASCADE;

ALTER TABLE public.retrospective_cards 
ADD CONSTRAINT fk_retrospective_cards_column_id 
FOREIGN KEY (column_id) REFERENCES public.retrospective_columns(id) ON DELETE CASCADE;