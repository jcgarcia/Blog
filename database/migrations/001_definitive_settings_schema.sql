-- DEFINITIVE DATABASE MIGRATION - Based on Production Backup Analysis
-- Source: blogprod.sql production backup from October 2025
-- Purpose: Create exact production schema to resolve OIDC/social media issues
-- 
-- CRITICAL: This migration creates the EXACT schema from production backup
-- DO NOT MODIFY without updating DEFINITIVE_DATABASE_SCHEMA.md

-- Create migration tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    schema_version VARCHAR(50),
    backup_source VARCHAR(255)
);

DO $$
DECLARE
    migration_name_var VARCHAR(255) := '001_definitive_settings_schema';
    schema_version_var VARCHAR(50) := '1.0.0-production-exact';
    backup_source_var VARCHAR(255) := 'blogprod.sql-2025-10-08';
BEGIN
    -- Check if migration has already been applied
    IF EXISTS (
        SELECT 1 FROM migration_history 
        WHERE migration_name = migration_name_var
        AND applied_at IS NOT NULL
    ) THEN
        RAISE NOTICE 'Migration % already applied, skipping...', migration_name_var;
        RETURN;
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'APPLYING DEFINITIVE MIGRATION: %', migration_name_var;
    RAISE NOTICE 'Schema Version: %', schema_version_var;
    RAISE NOTICE 'Source: %', backup_source_var;
    RAISE NOTICE '========================================';

    -- ========================================================================
    -- STEP 1: CREATE TRIGGER FUNCTION (Required for all timestamped tables)
    -- ========================================================================
    
    RAISE NOTICE 'Step 1: Creating update_updated_at_column function';
    
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- ========================================================================
    -- STEP 2: CREATE/FIX SETTINGS TABLE (EXACT PRODUCTION SCHEMA)
    -- ========================================================================
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings') THEN
        RAISE NOTICE 'Step 2a: Creating settings table with EXACT production schema';
        
        -- EXACT PRODUCTION SCHEMA FROM BACKUP
        CREATE TABLE settings (
            id SERIAL PRIMARY KEY,
            key VARCHAR(255) NOT NULL,
            value TEXT,
            type VARCHAR(50) DEFAULT 'string',
            group_name VARCHAR(100) DEFAULT 'general',
            description TEXT,
            is_public BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Add unique constraint on key (from production backup)
        ALTER TABLE settings ADD CONSTRAINT settings_key_key UNIQUE (key);

        RAISE NOTICE 'Step 2a: ✓ Settings table created with production schema';
    ELSE
        RAISE NOTICE 'Step 2b: Settings table exists - adding missing columns';
        
        -- Add missing columns if table exists but is incomplete
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'type'
        ) THEN
            ALTER TABLE settings ADD COLUMN type VARCHAR(50) DEFAULT 'string';
            RAISE NOTICE 'Step 2b: ✓ Added type column';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'group_name'
        ) THEN
            ALTER TABLE settings ADD COLUMN group_name VARCHAR(100) DEFAULT 'general';
            RAISE NOTICE 'Step 2b: ✓ Added group_name column';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'description'
        ) THEN
            ALTER TABLE settings ADD COLUMN description TEXT;
            RAISE NOTICE 'Step 2b: ✓ Added description column';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'is_public'
        ) THEN
            ALTER TABLE settings ADD COLUMN is_public BOOLEAN DEFAULT false;
            RAISE NOTICE 'Step 2b: ✓ Added is_public column';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'created_at'
        ) THEN
            ALTER TABLE settings ADD COLUMN created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Step 2b: ✓ Added created_at column';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'settings' AND column_name = 'updated_at'
        ) THEN
            ALTER TABLE settings ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Step 2b: ✓ Added updated_at column';
        END IF;

        -- Ensure unique constraint exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'settings' AND c.conname = 'settings_key_key'
        ) THEN
            ALTER TABLE settings ADD CONSTRAINT settings_key_key UNIQUE (key);
            RAISE NOTICE 'Step 2b: ✓ Added unique constraint on key';
        END IF;
    END IF;

    -- ========================================================================
    -- STEP 3: CREATE UPDATE TRIGGER (FROM PRODUCTION BACKUP)
    -- ========================================================================
    
    RAISE NOTICE 'Step 3: Creating updated_at trigger';
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_settings_updated_at' 
        AND tgrelid = 'settings'::regclass
    ) THEN
        CREATE TRIGGER update_settings_updated_at 
        BEFORE UPDATE ON settings 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE 'Step 3: ✓ Created update trigger for settings table';
    ELSE
        RAISE NOTICE 'Step 3: ✓ Update trigger already exists';
    END IF;

    -- ========================================================================
    -- STEP 4: CREATE MEDIA_FOLDERS TABLE (FROM PRODUCTION BACKUP)
    -- ========================================================================
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media_folders') THEN
        RAISE NOTICE 'Step 4: Creating media_folders table with production schema';
        
        -- EXACT PRODUCTION SCHEMA (note: no updated_at in production)
        CREATE TABLE media_folders (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            path VARCHAR(255) NOT NULL UNIQUE,
            parent_id INTEGER REFERENCES media_folders(id) ON DELETE CASCADE,
            created_by INTEGER, -- Note: no FK constraint in production backup
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for performance
        CREATE INDEX idx_media_folders_parent_id ON media_folders(parent_id);
        CREATE INDEX idx_media_folders_path ON media_folders(path);
        
        RAISE NOTICE 'Step 4: ✓ Media folders table created';
    ELSE
        RAISE NOTICE 'Step 4: ✓ Media folders table already exists';
    END IF;

    -- ========================================================================
    -- STEP 5: INSERT REQUIRED OAUTH SETTINGS (EXACT KEYS FROM APPLICATION)
    -- ========================================================================
    
    RAISE NOTICE 'Step 5: Inserting OAuth configuration settings';
    
    -- OAuth Settings (group_name = 'oauth', is_public = false)
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

    -- AWS COGNITO SETTINGS (Critical for OIDC dropdown)
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

    -- ========================================================================
    -- STEP 6: INSERT SOCIAL MEDIA SETTINGS (PUBLIC SETTINGS)
    -- ========================================================================
        
    RAISE NOTICE 'Step 6: Inserting social media settings';
    
    -- Social Media Settings (group_name = 'social', is_public = true)
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

    -- ========================================================================
    -- STEP 7: RECORD MIGRATION SUCCESS
    -- ========================================================================
    
    INSERT INTO migration_history (migration_name, description, schema_version, backup_source) 
    VALUES (
        migration_name_var, 
        'Definitive settings table creation based on exact production backup schema', 
        schema_version_var,
        backup_source_var
    );

    -- ========================================================================
    -- STEP 8: VERIFY MIGRATION SUCCESS
    -- ========================================================================
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION VERIFICATION';
    RAISE NOTICE '========================================';
    
    -- Verify settings table structure
    PERFORM 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'type';
    IF FOUND THEN
        RAISE NOTICE '✓ Settings table has type column';
    ELSE
        RAISE EXCEPTION '✗ Settings table missing type column - MIGRATION FAILED';
    END IF;
    
    PERFORM 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'group_name';
    IF FOUND THEN
        RAISE NOTICE '✓ Settings table has group_name column';
    ELSE
        RAISE EXCEPTION '✗ Settings table missing group_name column - MIGRATION FAILED';
    END IF;
    
    -- Verify OAuth settings exist
    PERFORM 1 FROM settings WHERE key = 'oauth_cognito_user_pool_id';
    IF FOUND THEN
        RAISE NOTICE '✓ OAuth Cognito settings exist';
    ELSE
        RAISE EXCEPTION '✗ OAuth Cognito settings missing - MIGRATION FAILED';
    END IF;
    
    -- Verify social media settings exist
    PERFORM 1 FROM settings WHERE key = 'social_linkedin_url';
    IF FOUND THEN
        RAISE NOTICE '✓ Social media settings exist';
    ELSE
        RAISE EXCEPTION '✗ Social media settings missing - MIGRATION FAILED';
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ MIGRATION COMPLETED SUCCESSFULLY';
    RAISE NOTICE 'Migration: %', migration_name_var;
    RAISE NOTICE 'Schema Version: %', schema_version_var;
    RAISE NOTICE 'Source: %', backup_source_var;
    RAISE NOTICE '========================================';

EXCEPTION 
    WHEN OTHERS THEN
        RAISE EXCEPTION 'MIGRATION FAILED: % - %', migration_name_var, SQLERRM;
END $$;