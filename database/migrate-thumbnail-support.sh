#!/bin/bash

# Thumbnail Support Database Migration Script
# This script applies the thumbnail support migration

set -e

echo "🖼️ Starting Thumbnail Support Database Migration..."

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

# Check if migration has already been applied
echo "🔍 Checking if thumbnail support migration has already been applied..."
THUMBNAIL_COLUMNS_EXIST=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "
    SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_name = 'media' 
    AND column_name IN ('thumbnail_path', 'thumbnail_url');
")

if [ "$THUMBNAIL_COLUMNS_EXIST" -eq 2 ]; then
    echo "✅ Thumbnail support migration has already been applied. Skipping..."
    exit 0
fi

# Apply thumbnail migration
echo "📋 Applying thumbnail support migration..."
echo "   - Adding thumbnail_path column to media table"
echo "   - Adding thumbnail_url column to media table"
echo ""

if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "api/migrations/20250914_add_thumbnail_support.sql"; then
    echo "✅ Thumbnail support migration applied successfully!"
else
    echo "❌ Failed to apply thumbnail support migration."
    exit 1
fi

echo ""
echo "🎯 Verifying migration..."

# Verify columns exist
THUMBNAIL_COLUMNS_COUNT=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "
    SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_name = 'media' 
    AND column_name IN ('thumbnail_path', 'thumbnail_url');
")

if [ "$THUMBNAIL_COLUMNS_COUNT" -eq 2 ]; then
    echo "✅ Thumbnail columns added successfully"
else
    echo "❌ Thumbnail columns not found. Migration may have failed."
    exit 1
fi

echo ""
echo "🎉 Thumbnail Support Migration Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Ensure poppler-utils is installed on production servers:"
echo "      Alpine Linux: apk add poppler-utils"
echo "      Ubuntu/Debian: apt-get install poppler-utils"
echo ""
echo "   2. Deploy updated backend code with PDF thumbnail generation"
echo ""
echo "   3. Test PDF upload and thumbnail generation"
echo ""
echo "   4. Optionally run batch thumbnail generation for existing PDFs"
echo ""
echo "✨ PDF Thumbnail generation is ready to use!"
