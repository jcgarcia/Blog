#!/bin/bash

# DEFINITIVE MIGRATION TESTING SCRIPT
# Purpose: Validate database schema after migration
# Date: October 8, 2025

set -e  # Exit on any error

echo "========================================"
echo "DATABASE SCHEMA VALIDATION SCRIPT"
echo "========================================"

# Database connection parameters (will be set by environment/Jenkins)
PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-postgres}
PGDATABASE=${PGDATABASE:-blog}

echo "Testing connection to: $PGHOST:$PGPORT/$PGDATABASE as $PGUSER"

# Test 1: Basic connectivity
echo "Test 1: Database connectivity..."
if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ Database connection successful"
else
    echo "✗ Database connection failed"
    exit 1
fi

# Test 2: Settings table exists
echo "Test 2: Settings table existence..."
TABLE_EXISTS=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings');" | tr -d ' ')
if [ "$TABLE_EXISTS" = "t" ]; then
    echo "✓ Settings table exists"
else
    echo "✗ Settings table does not exist"
    exit 1
fi

# Test 3: All required columns exist
echo "Test 3: Required columns verification..."
REQUIRED_COLUMNS=("id" "key" "value" "type" "group_name" "description" "is_public" "created_at" "updated_at")

for column in "${REQUIRED_COLUMNS[@]}"; do
    COLUMN_EXISTS=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = '$column');" | tr -d ' ')
    if [ "$COLUMN_EXISTS" = "t" ]; then
        echo "✓ Column '$column' exists"
    else
        echo "✗ Column '$column' missing"
        exit 1
    fi
done

# Test 4: Unique constraint on key column
echo "Test 4: Unique constraint verification..."
CONSTRAINT_EXISTS=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'settings' AND c.conname = 'settings_key_key');" | tr -d ' ')
if [ "$CONSTRAINT_EXISTS" = "t" ]; then
    echo "✓ Unique constraint on 'key' exists"
else
    echo "✗ Unique constraint on 'key' missing"
    exit 1
fi

# Test 5: Update trigger exists
echo "Test 5: Update trigger verification..."
TRIGGER_EXISTS=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_settings_updated_at' AND tgrelid = 'settings'::regclass);" | tr -d ' ')
if [ "$TRIGGER_EXISTS" = "t" ]; then
    echo "✓ Update trigger exists"
else
    echo "✗ Update trigger missing"
    exit 1
fi

# Test 6: OAuth settings exist
echo "Test 6: OAuth settings verification..."
OAUTH_KEYS=("oauth_google_client_id" "oauth_cognito_user_pool_id" "oauth_cognito_client_id" "oauth_cognito_client_secret" "oauth_cognito_region" "oauth_cognito_domain")

for key in "${OAUTH_KEYS[@]}"; do
    KEY_EXISTS=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT EXISTS (SELECT 1 FROM settings WHERE key = '$key');" | tr -d ' ')
    if [ "$KEY_EXISTS" = "t" ]; then
        echo "✓ OAuth setting '$key' exists"
    else
        echo "✗ OAuth setting '$key' missing"
        exit 1
    fi
done

# Test 7: Social media settings exist
echo "Test 7: Social media settings verification..."
SOCIAL_KEYS=("social_linkedin_url" "social_twitter_url" "social_instagram_url" "social_threads_url")

for key in "${SOCIAL_KEYS[@]}"; do
    KEY_EXISTS=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT EXISTS (SELECT 1 FROM settings WHERE key = '$key');" | tr -d ' ')
    if [ "$KEY_EXISTS" = "t" ]; then
        echo "✓ Social media setting '$key' exists"
    else
        echo "✗ Social media setting '$key' missing"
        exit 1
    fi
done

# Test 8: Media folders table exists
echo "Test 8: Media folders table verification..."
MEDIA_FOLDERS_EXISTS=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media_folders');" | tr -d ' ')
if [ "$MEDIA_FOLDERS_EXISTS" = "t" ]; then
    echo "✓ Media folders table exists"
else
    echo "✗ Media folders table missing"
    exit 1
fi

# Test 9: Migration history recorded
echo "Test 9: Migration history verification..."
MIGRATION_RECORDED=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT EXISTS (SELECT 1 FROM migration_history WHERE migration_name = '001_definitive_settings_schema');" | tr -d ' ')
if [ "$MIGRATION_RECORDED" = "t" ]; then
    echo "✓ Migration recorded in history"
else
    echo "✗ Migration not recorded in history"
    exit 1
fi

# Test 10: Settings data integrity
echo "Test 10: Settings data integrity..."
OAUTH_GROUP_COUNT=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT COUNT(*) FROM settings WHERE group_name = 'oauth';" | tr -d ' ')
SOCIAL_GROUP_COUNT=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT COUNT(*) FROM settings WHERE group_name = 'social';" | tr -d ' ')

if [ "$OAUTH_GROUP_COUNT" -ge 6 ]; then
    echo "✓ OAuth settings group has $OAUTH_GROUP_COUNT entries (expected: ≥6)"
else
    echo "✗ OAuth settings group has only $OAUTH_GROUP_COUNT entries (expected: ≥6)"
    exit 1
fi

if [ "$SOCIAL_GROUP_COUNT" -ge 4 ]; then
    echo "✓ Social settings group has $SOCIAL_GROUP_COUNT entries (expected: ≥4)"
else
    echo "✗ Social settings group has only $SOCIAL_GROUP_COUNT entries (expected: ≥4)"
    exit 1
fi

# Final verification: Display settings summary
echo "========================================"
echo "SETTINGS SUMMARY"
echo "========================================"

echo "Settings by group:"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
SELECT 
    group_name,
    COUNT(*) as setting_count,
    COUNT(*) FILTER (WHERE value != '') as configured_count
FROM settings 
GROUP BY group_name 
ORDER BY group_name;
"

echo "Recent migrations:"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "
SELECT 
    migration_name,
    schema_version,
    backup_source,
    applied_at
FROM migration_history 
ORDER BY applied_at DESC 
LIMIT 5;
"

echo "========================================"
echo "✓ ALL TESTS PASSED - SCHEMA IS VALID"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Test social media links via admin interface"
echo "2. Test OAuth configuration via admin interface"  
echo "3. Verify OIDC dropdown shows Cognito option"
echo "4. Deploy to production via CI/CD pipeline"