-- Migration: Create comments table for social features
-- Purpose: Add comments functionality to blog posts
-- Date: 2025-10-11
-- Context: Comments system was implemented but missing database table

BEGIN;

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'approved',
    author_name VARCHAR(255), -- For legacy/guest comments
    author_email VARCHAR(255), -- For legacy/guest comments
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);

-- Create status index only if status column exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='comments' AND column_name='status') THEN
        CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
    END IF;
END $$;

-- Add comment count column to posts table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='posts' AND column_name='comment_count') THEN
        ALTER TABLE posts ADD COLUMN comment_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create post_shares table for social sharing tracking
CREATE TABLE IF NOT EXISTS post_shares (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for post_shares
CREATE INDEX IF NOT EXISTS idx_post_shares_post_id ON post_shares(post_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_platform ON post_shares(platform);

-- Add share count column to posts table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='posts' AND column_name='share_count') THEN
        ALTER TABLE posts ADD COLUMN share_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Update existing posts to have correct comment and share counts
UPDATE posts SET comment_count = 0 WHERE comment_count IS NULL;
UPDATE posts SET share_count = 0 WHERE share_count IS NULL;

COMMIT;