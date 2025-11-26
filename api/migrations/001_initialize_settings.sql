-- Migration: Initialize settings table with OIDC configuration
-- Purpose: Fix missing system settings that caused media URL generation failure
-- Date: 2025-10-10
-- Context: After database recreation, the settings table was missing critical AWS/OIDC config

BEGIN;

-- Create settings table if it doesn't exist with all expected columns
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    category VARCHAR(100) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert AWS/OIDC configuration if it doesn't exist
INSERT INTO settings (key, value, description) 
VALUES (
    'aws_config',
    '{"authMethod":"oidc","region":"eu-west-2","bucketName":"bedtimeblog-medialibrary","roleArn":"arn:aws:iam::007041844937:role/BedtimeBlogMediaRole","oidcIssuerUrl":"https://oidc.ingasti.com","oidcAudience":"https://oidc.ingasti.com","oidcSubject":"system:serviceaccount:blog:media-access-sa"}',
    'AWS S3 configuration with OIDC authentication'
) ON CONFLICT (key) DO NOTHING;

-- Insert default system settings with all expected columns
INSERT INTO settings (key, value, description, is_public, category) VALUES
('system.version', '1.0.0', 'Current system version', false, 'system'),
('system.maintenance_mode', 'false', 'Enable/disable maintenance mode', false, 'system'),
('blog.title', 'Bedtime Blog', 'The main title of the blog', true, 'general'),
('blog.description', 'A cozy place for bedtime stories and thoughts', 'Blog description/tagline', true, 'general'),
('blog.posts_per_page', '10', 'Number of posts to display per page', true, 'general'),
('ui.theme', 'default', 'Current UI theme', true, 'appearance'),
('ui.enable_dark_mode', 'true', 'Enable dark mode toggle', true, 'appearance'),
('ui.show_author_info', 'true', 'Display author information on posts', true, 'content'),
('content.allow_comments', 'true', 'Enable comments on posts', true, 'content'),
('content.moderate_comments', 'true', 'Require comment moderation', false, 'content')
ON CONFLICT (key) DO NOTHING;

COMMIT;