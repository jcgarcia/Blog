#!/bin/bash

# Media Library Database Migration Script
# This script applies the media library database schema

set -e

echo "🗄️ Starting Media Library Database Migration..."

# Source database configuration
if [ -f ".env.local" ]; then
    source .env.local
elif [ -f ".env" ]; then
    source .env
else
    echo "❌ No environment file found. Please create .env or .env.local with database credentials."
    exit 1
fi

# Check required environment variables
if [ -z "$PGHOST" ] || [ -z "$PGPORT" ] || [ -z "$PGUSER" ] || [ -z "$PGPASSWORD" ] || [ -z "$PGDATABASE" ]; then
    echo "❌ Missing required database environment variables:"
    echo "   PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE"
    exit 1
fi

echo "📊 Database Connection Info:"
echo "   Host: $PGHOST"
echo "   Port: $PGPORT"
echo "   Database: $PGDATABASE"
echo "   User: $PGUSER"
echo ""

# Test database connection
echo "🔍 Testing database connection..."
export PGPASSWORD="$PGPASSWORD"

if ! psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Failed to connect to database. Please check your credentials."
    exit 1
fi

echo "✅ Database connection successful!"
echo ""

# Apply media schema
echo "📋 Applying media library schema..."
echo "   - Creating media table"
echo "   - Creating media_folders table"
echo "   - Setting up indexes"
echo "   - Adding media settings"
echo ""

if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "database/media_schema.sql"; then
    echo "✅ Media library schema applied successfully!"
else
    echo "❌ Failed to apply media library schema."
    exit 1
fi

echo ""
echo "🎯 Verifying installation..."

# Verify tables exist
TABLES_COUNT=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_name IN ('media', 'media_folders') 
    AND table_schema = 'public';
")

if [ "$TABLES_COUNT" -eq 2 ]; then
    echo "✅ Media tables created successfully"
else
    echo "❌ Media tables not found. Migration may have failed."
    exit 1
fi

# Check settings
SETTINGS_COUNT=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "
    SELECT COUNT(*) FROM settings WHERE group_name = 'media';
")

if [ "$SETTINGS_COUNT" -gt 0 ]; then
    echo "✅ Media settings configured successfully"
else
    echo "❌ Media settings not found. Migration may have failed."
    exit 1
fi

echo ""
echo "🎉 Media Library Database Migration Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Configure AWS S3 credentials in environment variables:"
echo "      - AWS_ACCESS_KEY_ID"
echo "      - AWS_SECRET_ACCESS_KEY"
echo "      - AWS_REGION"
echo "      - S3_BUCKET_NAME"
echo "      - CDN_URL"
echo ""
echo "   2. Install required npm packages:"
echo "      cd api && pnpm install"
echo ""
echo "   3. Restart the backend service"
echo ""
echo "✨ Your Media Library is ready to use!"
