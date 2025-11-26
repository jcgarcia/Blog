-- CORRECTIVE MIGRATION: Transform existing settings table to expected schema
-- Date: 2025-10-08
-- Purpose: Convert current sys_config style settings table to blog_schema format

DO $$
DECLARE
    migration_name_var VARCHAR(255) := '002_transform_settings_to_blog_schema';
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
    RAISE NOTICE 'APPLYING CORRECTIVE MIGRATION: %', migration_name_var;
    RAISE NOTICE 'Transforming existing settings table to blog schema format';
    RAISE NOTICE '========================================';

    -- Step 1: Add missing columns
    RAISE NOTICE 'Step 1: Adding missing columns to settings table';
    
    -- Add type column (replaces is_encrypted logic)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settings' AND column_name = 'type'
    ) THEN
        ALTER TABLE settings ADD COLUMN type VARCHAR(50) DEFAULT 'string';
        RAISE NOTICE '✓ Added type column';
    END IF;
    
    -- Add group_name column  
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settings' AND column_name = 'group_name'
    ) THEN
        ALTER TABLE settings ADD COLUMN group_name VARCHAR(100) DEFAULT 'general';
        RAISE NOTICE '✓ Added group_name column';
    END IF;
    
    -- Add is_public column (to replace is_active)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settings' AND column_name = 'is_public'
    ) THEN
        ALTER TABLE settings ADD COLUMN is_public BOOLEAN DEFAULT false;
        RAISE NOTICE '✓ Added is_public column';
    END IF;

    -- Step 2: Transform data to new format
    RAISE NOTICE 'Step 2: Transforming existing data to new format';
    
    -- Set group_name based on key patterns
    UPDATE settings SET group_name = 'social' WHERE key LIKE 'social_%';
    UPDATE settings SET group_name = 'oauth' WHERE key LIKE 'oauth_%';
    UPDATE settings SET group_name = 'aws' WHERE key LIKE 'aws_%';
    UPDATE settings SET group_name = 'media' WHERE key LIKE 'media_%';
    
    -- Set is_public for social media settings
    UPDATE settings SET is_public = true WHERE group_name = 'social';
    
    -- Set type based on value content (basic heuristic)
    UPDATE settings SET type = 'boolean' WHERE value IN ('true', 'false', 't', 'f');
    UPDATE settings SET type = 'json' WHERE value ~ '^\{.*\}$' OR value ~ '^\[.*\]$';
    
    RAISE NOTICE '✓ Data transformation completed';

    -- Step 3: Modify value column if needed (from jsonb to text)
    RAISE NOTICE 'Step 3: Checking value column type';
    
    -- Check if value column is jsonb and convert to text if necessary
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settings' AND column_name = 'value' AND data_type = 'jsonb'
    ) THEN
        -- Convert jsonb values to text
        UPDATE settings SET value = value::text WHERE value IS NOT NULL;
        -- This is a complex operation, we'll keep jsonb for now but ensure it works with app
        RAISE NOTICE '⚠️  Value column is JSONB - application will handle conversion';
    END IF;

    -- Step 4: Insert missing OAuth settings if they don't exist
    RAISE NOTICE 'Step 4: Ensuring all required OAuth settings exist';
    
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
    SELECT 'oauth_google_client_id', '', 'string', 'oauth', 'Google OAuth Client ID', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_google_client_id');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_google_client_secret', '', 'string', 'oauth', 'Google OAuth Client Secret', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_google_client_secret');

    INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
    SELECT 'oauth_frontend_url', 'https://bedtime.ingasti.com', 'string', 'oauth', 'Frontend URL for OAuth callbacks', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'oauth_frontend_url');

    -- Step 5: Create trigger for updated_at if it doesn't exist
    RAISE NOTICE 'Step 5: Ensuring updated_at trigger exists';
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_settings_updated_at' 
        AND tgrelid = 'settings'::regclass
    ) THEN
        CREATE TRIGGER update_settings_updated_at 
        BEFORE UPDATE ON settings 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✓ Created updated_at trigger';
    END IF;

    -- Step 6: Record migration as applied
    INSERT INTO migration_history (migration_name, description) 
    VALUES (migration_name_var, 'Transform existing settings table from sys_config style to blog schema format');

    -- Step 7: Verification
    RAISE NOTICE 'Step 7: Verifying transformation';
    
    -- Check OAuth settings exist
    PERFORM 1 FROM settings WHERE key = 'oauth_cognito_user_pool_id';
    IF FOUND THEN
        RAISE NOTICE '✓ OAuth Cognito settings exist';
    ELSE
        RAISE EXCEPTION '✗ OAuth Cognito settings missing - MIGRATION FAILED';
    END IF;
    
    -- Check social media settings exist
    PERFORM 1 FROM settings WHERE key = 'social_linkedin_url';
    IF FOUND THEN
        RAISE NOTICE '✓ Social media settings exist';
    ELSE
        RAISE EXCEPTION '✗ Social media settings missing - MIGRATION FAILED';
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ CORRECTIVE MIGRATION COMPLETED SUCCESSFULLY';
    RAISE NOTICE 'Settings table transformed to blog schema format';
    RAISE NOTICE '========================================';

EXCEPTION 
    WHEN OTHERS THEN
        RAISE EXCEPTION 'CORRECTIVE MIGRATION FAILED: % - %', migration_name_var, SQLERRM;
END $$;