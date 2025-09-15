-- Update retrospectives table to make iteration_id a text field instead of UUID
-- This allows users to enter any iteration name instead of being restricted to capacity iterations

-- First, drop the existing foreign key constraint if it exists
ALTER TABLE retrospectives DROP CONSTRAINT IF EXISTS retrospectives_iteration_id_fkey;

-- Change the iteration_id column to TEXT type
ALTER TABLE retrospectives ALTER COLUMN iteration_id TYPE TEXT;

-- Make iteration_id nullable since some retrospectives might not have an iteration specified
ALTER TABLE retrospectives ALTER COLUMN iteration_id DROP NOT NULL;