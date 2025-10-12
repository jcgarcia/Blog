-- Migration: Add trash/bin system for media files
-- This adds support for soft delete with trash functionality

-- Add trash-related columns to media table
ALTER TABLE media 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS trash_s3_key VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS trash_thumbnail_key VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS original_s3_key VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS original_thumbnail_key VARCHAR(255) NULL;

-- Create index for faster queries on deleted files
CREATE INDEX IF NOT EXISTS idx_media_is_deleted ON media(is_deleted);
CREATE INDEX IF NOT EXISTS idx_media_deleted_at ON media(deleted_at);

-- Update existing files to mark them as not deleted (safety measure)
UPDATE media SET is_deleted = FALSE WHERE is_deleted IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN media.is_deleted IS 'Indicates if the file has been moved to trash';
COMMENT ON COLUMN media.deleted_at IS 'Timestamp when the file was moved to trash';
COMMENT ON COLUMN media.trash_s3_key IS 'S3 key where the file is stored in trash folder';
COMMENT ON COLUMN media.trash_thumbnail_key IS 'S3 key where the thumbnail is stored in trash folder';
COMMENT ON COLUMN media.original_s3_key IS 'Original S3 key before moving to trash (for restore)';
COMMENT ON COLUMN media.original_thumbnail_key IS 'Original thumbnail S3 key before moving to trash (for restore)';