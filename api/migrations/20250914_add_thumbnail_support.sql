-- Migration: Add thumbnail support to media table
-- Date: 2025-09-14
-- Description: Add thumbnail_path and thumbnail_url columns to support PDF thumbnails

-- Add thumbnail columns to media table
ALTER TABLE media ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(512);
ALTER TABLE media ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(1024);

-- Add index for faster queries on files with thumbnails
CREATE INDEX IF NOT EXISTS idx_media_thumbnail_path ON media(thumbnail_path) WHERE thumbnail_path IS NOT NULL;

-- Update media table comments
COMMENT ON COLUMN media.thumbnail_path IS 'Relative path to thumbnail file in storage';
COMMENT ON COLUMN media.thumbnail_url IS 'Public URL for thumbnail access';

-- Show the updated table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'media' 
ORDER BY ordinal_position;
