-- Restore Production Settings from Backup Analysis
-- Based on blogprod.sql backup analysis
-- Date: 2025-10-08

-- This script inserts production settings values identified from the backup

DO $$
BEGIN
    RAISE NOTICE 'Restoring production settings from backup analysis...';
    
    -- AWS S3 Media Settings (identified from backup)
    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    VALUES ('media_storage_s3_bucket', '"bedtime-blog-media"'::jsonb, 'string', 'media', 'S3 bucket name for media storage', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Media storage type (from backup analysis showing S3 usage)
    INSERT INTO settings (key, value, type, group_name, description, is_public, updated_at)
    VALUES ('media_storage_type', '"aws"'::jsonb, 'string', 'media', 'Media storage provider', false, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Blog configuration (common production values)
    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    VALUES ('site_title', '"Bedtime Stories Blog"'::jsonb, 'string', 'general', 'Website title', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP;
    
    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    VALUES ('site_url', '"https://bedtime.ingasti.com"'::jsonb, 'string', 'general', 'Website URL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP;
    
    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    VALUES ('site_description', '"A cozy corner for bedtime stories and peaceful tales"'::jsonb, 'string', 'general', 'Website description', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP;
    
    -- API configuration  
    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    VALUES ('api_url', '"https://bapi.ingasti.com"'::jsonb, 'string', 'general', 'API base URL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Content settings
    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    VALUES ('posts_per_page', '10'::jsonb, 'number', 'content', 'Number of posts per page', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP;
    
    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    VALUES ('allow_comments', 'true'::jsonb, 'boolean', 'content', 'Allow comments on posts', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP;
    
    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    VALUES ('comment_moderation', 'false'::jsonb, 'boolean', 'content', 'Require comment moderation', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Social media placeholders (will be configured via admin)
    UPDATE settings SET 
        value = '""'::jsonb,
        description = 'LinkedIn profile URL for social media integration'
    WHERE key = 'social_linkedin_url';
    
    UPDATE settings SET 
        value = '""'::jsonb,
        description = 'Twitter/X profile URL for social media integration'
    WHERE key = 'social_twitter_url';
    
    UPDATE settings SET 
        value = '""'::jsonb,
        description = 'Instagram profile URL for social media integration'
    WHERE key = 'social_instagram_url';
    
    UPDATE settings SET 
        value = '""'::jsonb,
        description = 'Threads profile URL for social media integration'
    WHERE key = 'social_threads_url';

    RAISE NOTICE '✓ Production settings restored from backup analysis';
    
END $$;