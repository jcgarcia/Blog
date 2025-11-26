-- Add 'scheduled' status to posts table
-- Migration: 009_add_scheduled_status.sql
-- Date: 2025-11-19

-- Drop the existing check constraint
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;

-- Add new check constraint with 'scheduled' status
ALTER TABLE posts ADD CONSTRAINT posts_status_check 
  CHECK (status IN ('draft', 'published', 'private', 'archived', 'scheduled'));

-- Create index on published_at for scheduled posts queries
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(published_at) WHERE status = 'scheduled';

-- Add comment
COMMENT ON COLUMN posts.published_at IS 'Timestamp when post was published or scheduled to be published';
