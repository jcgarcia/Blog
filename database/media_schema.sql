-- Media Library Database Schema
-- File: media_schema.sql
-- Purpose: Create media management tables for AWS S3 integration

-- Drop existing table if it exists (for development)
DROP TABLE IF EXISTS media CASCADE;

-- Create media table for tracking uploaded files
CREATE TABLE media (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  
  -- S3 Configuration
  s3_key VARCHAR(500) NOT NULL UNIQUE,
  s3_bucket VARCHAR(100) NOT NULL DEFAULT 'bedtime-blog-media',
  public_url TEXT NOT NULL,
  
  -- Organization
  folder_path VARCHAR(255) DEFAULT '/',
  tags TEXT[] DEFAULT '{}',
  alt_text TEXT,
  description TEXT,
  
  -- Metadata
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  mime_type VARCHAR(100),
  width INTEGER,
  height INTEGER,
  thumbnail_key VARCHAR(500), -- S3 key for thumbnail image
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_media_uploaded_by ON media(uploaded_by);
CREATE INDEX idx_media_file_type ON media(file_type);
CREATE INDEX idx_media_folder_path ON media(folder_path);
CREATE INDEX idx_media_created_at ON media(created_at DESC);
CREATE INDEX idx_media_tags ON media USING GIN(tags);

-- Create folders table for organizing media
CREATE TABLE media_folders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  path VARCHAR(255) NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES media_folders(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default folders
INSERT INTO media_folders (name, path, parent_id) VALUES 
('Root', '/', NULL),
('Images', '/images', 1),
('Documents', '/documents', 1),
('Videos', '/videos', 1);

-- Create updated_at trigger for media table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_media_updated_at 
    BEFORE UPDATE ON media 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add settings for media configuration
INSERT INTO settings (group_name, key_name, value, description) VALUES 
('media', 's3_bucket_name', 'bedtime-blog-media', 'AWS S3 bucket name for media storage'),
('media', 's3_region', 'us-east-1', 'AWS S3 region'),
('media', 'max_file_size', '10485760', 'Maximum file size in bytes (10MB)'),
('media', 'allowed_file_types', 'jpg,jpeg,png,gif,webp,pdf,mp4,mov', 'Allowed file extensions'),
('media', 'cdn_url', 'https://media.ingasti.com', 'CDN URL for media delivery'),
('media', 'upload_folder_structure', 'date', 'Folder structure: date, user, category')
ON CONFLICT (group_name, key_name) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON media TO blog_user;
-- GRANT ALL PRIVILEGES ON media_folders TO blog_user;
-- GRANT USAGE, SELECT ON SEQUENCE media_id_seq TO blog_user;
-- GRANT USAGE, SELECT ON SEQUENCE media_folders_id_seq TO blog_user;
