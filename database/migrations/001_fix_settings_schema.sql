-- Create settings table based on production backup schema
-- Date: 2025-10-08
-- Based on blogprod.sql backup from production database

-- Create migration tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

DO $$
BEGIN
    -- Check if migration has already been applied
    IF EXISTS (
        SELECT 1 FROM migration_history 
        WHERE migration_name = '001_fix_settings_schema' 
        AND applied_at IS NOT NULL
    ) THEN
        RAISE NOTICE 'Migration 001_fix_settings_schema already applied, skipping...';
        RETURN;
    END IF;

    RAISE NOTICE 'Applying migration: 001_fix_settings_schema';

    -- Create settings table matching production schema from backup
    -- This matches the exact structure found in blogprod.sql
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings') THEN
        CREATE TABLE settings (
            id SERIAL PRIMARY KEY,
            key VARCHAR(255) NOT NULL UNIQUE,
            value TEXT,
            type VARCHAR(50) DEFAULT 'string',
            group_name VARCHAR(100) DEFAULT 'general',
            description TEXT,
            is_public BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Add unique constraint on key
        ALTER TABLE settings ADD CONSTRAINT settings_key_key UNIQUE (key);

        RAISE NOTICE 'Created settings table with production schema';
    ELSE
        -- Table exists, add missing columns if needed
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'type'
        ) THEN
            ALTER TABLE settings ADD COLUMN type VARCHAR(50) DEFAULT 'string';
            RAISE NOTICE 'Added type column to settings table';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'group_name'
        ) THEN
            ALTER TABLE settings ADD COLUMN group_name VARCHAR(100) DEFAULT 'general';
            RAISE NOTICE 'Added group_name column to settings table';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'description'
        ) THEN
            ALTER TABLE settings ADD COLUMN description TEXT;
            RAISE NOTICE 'Added description column to settings table';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'is_public'
        ) THEN
            ALTER TABLE settings ADD COLUMN is_public BOOLEAN DEFAULT false;
            RAISE NOTICE 'Added is_public column to settings table';
        END IF;

        -- Ensure created_at and updated_at columns exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'created_at'
        ) THEN
            ALTER TABLE settings ADD COLUMN created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Added created_at column to settings table';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'updated_at'
        ) THEN
            ALTER TABLE settings ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Added updated_at column to settings table';
        END IF;

        -- Ensure unique constraint exists on key column
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'settings' AND c.conname = 'settings_key_key'
        ) THEN
            ALTER TABLE settings ADD CONSTRAINT settings_key_key UNIQUE (key);
            RAISE NOTICE 'Added unique constraint on settings.key';
        END IF;
    END IF;

    -- Create trigger function for updated_at if it doesn't exist
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create trigger for updated_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_settings_updated_at' 
        AND tgrelid = 'settings'::regclass
    ) THEN
        CREATE TRIGGER update_settings_updated_at 
        BEFORE UPDATE ON settings 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created updated_at trigger for settings table';
    END IF;

    -- Create media_folders table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media_folders') THEN
        CREATE TABLE media_folders (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            path VARCHAR(500) NOT NULL UNIQUE,
            parent_id INTEGER REFERENCES media_folders(id) ON DELETE CASCADE,
            description TEXT,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes
        CREATE INDEX idx_media_folders_parent_id ON media_folders(parent_id);
        CREATE INDEX idx_media_folders_path ON media_folders(path);

        -- Create trigger for updated_at
        CREATE TRIGGER update_media_folders_updated_at 
        BEFORE UPDATE ON media_folders 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        RAISE NOTICE 'Created media_folders table';
    END IF;

    -- Insert default social media settings if they don't exist
    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'social_linkedin_url', '', 'string', 'social', 'LinkedIn profile URL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'social_linkedin_url');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'social_twitter_url', '', 'string', 'social', 'Twitter profile URL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'social_twitter_url');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'social_instagram_url', '', 'string', 'social', 'Instagram profile URL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'social_instagram_url');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'social_threads_url', '', 'string', 'social', 'Threads profile URL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'social_threads_url');

    -- Insert OAuth placeholder settings
    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_google_client_id', '', 'string', 'oauth', 'Google OAuth Client ID', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_google_client_id');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_google_client_secret', '', 'string', 'oauth', 'Google OAuth Client Secret', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_google_client_secret');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_facebook_app_id', '', 'string', 'oauth', 'Facebook App ID', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_facebook_app_id');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_facebook_app_secret', '', 'string', 'oauth', 'Facebook App Secret', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_facebook_app_secret');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_twitter_consumer_key', '', 'string', 'oauth', 'Twitter Consumer Key', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_twitter_consumer_key');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_twitter_consumer_secret', '', 'string', 'oauth', 'Twitter Consumer Secret', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_twitter_consumer_secret');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_cognito_user_pool_id', '', 'string', 'oauth', 'AWS Cognito User Pool ID', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_cognito_user_pool_id');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_cognito_client_id', '', 'string', 'oauth', 'AWS Cognito Client ID', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_cognito_client_id');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_cognito_client_secret', '', 'string', 'oauth', 'AWS Cognito Client Secret', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_cognito_client_secret');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_cognito_region', '', 'string', 'oauth', 'AWS Cognito Region', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_cognito_region');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_cognito_domain', '', 'string', 'oauth', 'AWS Cognito Domain', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_cognito_domain');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_frontend_url', 'https://bedtime.ingasti.com', 'string', 'oauth', 'Frontend URL for OAuth callbacks', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_frontend_url');

    -- Record migration as applied
    INSERT INTO migration_history (migration_name, description) 
    VALUES ('001_fix_settings_schema', 'Create/fix settings table based on production backup schema');

    RAISE NOTICE 'Migration 001_fix_settings_schema applied successfully';

EXCEPTION 
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Migration 001_fix_settings_schema failed: %', SQLERRM;
END $$;