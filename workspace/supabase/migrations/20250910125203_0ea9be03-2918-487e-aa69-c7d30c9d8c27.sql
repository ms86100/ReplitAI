-- Fix member_weekly_availability table structure to match what the UI expects

-- Check if calculated_days_present column exists and add it if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'member_weekly_availability' 
        AND column_name = 'calculated_days_present'
    ) THEN
        ALTER TABLE member_weekly_availability 
        ADD COLUMN calculated_days_present INTEGER DEFAULT 5;
    END IF;
END $$;

-- Check if calculated_days_total column exists and add it if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'member_weekly_availability' 
        AND column_name = 'calculated_days_total'
    ) THEN
        ALTER TABLE member_weekly_availability 
        ADD COLUMN calculated_days_total INTEGER DEFAULT 5;
    END IF;
END $$;

-- Add notes column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'member_weekly_availability' 
        AND column_name = 'notes'
    ) THEN
        ALTER TABLE member_weekly_availability 
        ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Update calculated columns based on existing data
UPDATE member_weekly_availability 
SET 
    calculated_days_present = GREATEST(0, 5 - COALESCE(leaves, 0)),
    calculated_days_total = 5
WHERE calculated_days_present IS NULL OR calculated_days_total IS NULL;