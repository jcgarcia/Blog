-- Migration 011: Enforce strict authentication for comments
-- Description: Ensure comments table NEVER allows anonymous comments
-- Date: 2025-10-11

-- Remove any existing anonymous comments (should already be done)
DELETE FROM comments WHERE user_id IS NULL;

-- Add NOT NULL constraint to user_id to prevent anonymous comments
ALTER TABLE comments ALTER COLUMN user_id SET NOT NULL;

-- Add a check constraint to ensure user_id is always positive
ALTER TABLE comments ADD CONSTRAINT comments_valid_user_id CHECK (user_id > 0);

-- Update comment counts for all posts to reflect current state
UPDATE posts SET comment_count = (
  SELECT COUNT(*) FROM comments 
  WHERE comments.post_id = posts.id 
  AND comments.status = 'approved'
);

-- Create index for better performance on authenticated comment queries
CREATE INDEX IF NOT EXISTS idx_comments_user_post ON comments(user_id, post_id);

-- Migration completed successfully (no migration_log table available)