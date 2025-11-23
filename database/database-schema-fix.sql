-- DATABASE SCHEMA FIX FOR MEDIA FUNCTIONALITY
-- This script ensures the media table has all fields required by the working code

-- First, let's see what we have
-- \d media;

-- Add missing columns that the code expects (if they don't exist)
ALTER TABLE media ADD COLUMN IF NOT EXISTS s3_key VARCHAR(512);
ALTER TABLE media ADD COLUMN IF NOT EXISTS s3_bucket VARCHAR(128);
ALTER TABLE media ADD COLUMN IF NOT EXISTS public_url TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS folder_path VARCHAR(255) DEFAULT '/';
ALTER TABLE media ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE media ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS thumbnail_key VARCHAR(512);
ALTER TABLE media ADD COLUMN IF NOT EXISTS file_type VARCHAR(100);
ALTER TABLE media ADD COLUMN IF NOT EXISTS is_thumbnail BOOLEAN DEFAULT FALSE;
ALTER TABLE media ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(512);
ALTER TABLE media ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE media ADD COLUMN IF NOT EXISTS caption TEXT;

-- Update existing records to populate missing fields based on existing data
UPDATE media SET 
  s3_key = file_path,
  s3_bucket = 'bedtimeblog-medialibrary',
  folder_path = '/',
  file_type = CASE 
    WHEN mime_type LIKE 'image/%' THEN 'image'
    WHEN mime_type LIKE 'video/%' THEN 'video' 
    WHEN mime_type LIKE 'application/pdf%' THEN 'document'
    ELSE 'file'
  END,
  is_thumbnail = FALSE,
  is_featured = FALSE
WHERE s3_key IS NULL OR s3_key = '';

-- Ensure we have the media_folders table for folder management
CREATE TABLE IF NOT EXISTS media_folders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  path VARCHAR(255) NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES media_folders(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER
);

-- Insert default folders if they don't exist
INSERT INTO media_folders (name, path, description) VALUES 
  ('Root', '/', 'Root folder for all media'),
  ('Images', '/images', 'Image files and photos'),
  ('Documents', '/documents', 'PDF and document files'),
  ('Videos', '/videos', 'Video files')
ON CONFLICT (path) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_media_folder_path ON media(folder_path);
CREATE INDEX IF NOT EXISTS idx_media_file_type ON media(file_type);
CREATE INDEX IF NOT EXISTS idx_media_is_thumbnail ON media(is_thumbnail);
CREATE INDEX IF NOT EXISTS idx_media_s3_key ON media(s3_key);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at);

-- Display the final schema
\d media;
\d media_folders;

-- Show sample data to verify
SELECT id, filename, original_name, s3_key, s3_bucket, folder_path, file_type, is_thumbnail 
FROM media 
ORDER BY created_at DESC 
LIMIT 5;