-- Migration 012: Fix media table file_path constraint
-- Purpose: Make file_path nullable to match working code expectations
-- Context: Code was working before migrations, file_path should be optional
-- Date: 2025-10-12

BEGIN;

-- Make file_path nullable if it exists and is currently NOT NULL
DO $$ 
BEGIN
    -- Check if file_path column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' 
        AND column_name = 'file_path' 
        AND is_nullable = 'NO'
    ) THEN
        -- Make file_path nullable
        ALTER TABLE media ALTER COLUMN file_path DROP NOT NULL;
        RAISE NOTICE 'Made file_path column nullable in media table';
    ELSE
        RAISE NOTICE 'file_path column is already nullable or does not exist';
    END IF;
END $$;

COMMIT;