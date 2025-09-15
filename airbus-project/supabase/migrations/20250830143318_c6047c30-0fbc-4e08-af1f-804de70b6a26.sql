-- Add missing foreign key relationships for retrospective tables
-- This allows PostgREST to perform nested selects that the code expects

-- Add foreign key from retrospective_columns to retrospectives
ALTER TABLE public.retrospective_columns 
ADD CONSTRAINT fk_retrospective_columns_retrospective_id 
FOREIGN KEY (retrospective_id) REFERENCES public.retrospectives(id) ON DELETE CASCADE;

-- Add foreign key from retrospective_cards to retrospective_columns  
ALTER TABLE public.retrospective_cards 
ADD CONSTRAINT fk_retrospective_cards_column_id 
FOREIGN KEY (column_id) REFERENCES public.retrospective_columns(id) ON DELETE CASCADE;