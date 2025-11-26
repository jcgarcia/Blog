#!/bin/bash
# Backup restoration script
# Usage: restore-backup.sh <backup_file_path>

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Error: No backup file specified"
    echo "Usage: $0 <backup_file_path>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file '$BACKUP_FILE' not found"
    exit 1
fi

echo "🔄 Starting database restoration from: $BACKUP_FILE"

# Get database configuration
DB_NAME="${POSTGRES_DB:-blog}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL connection..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 2
done

echo "✅ PostgreSQL is ready"

# Check backup file size and format
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "📊 Backup file size: $BACKUP_SIZE"

# Verify backup file is valid SQL
if ! head -20 "$BACKUP_FILE" | grep -q "PostgreSQL database dump"; then
    echo "⚠️ Warning: Backup file may not be a valid PostgreSQL dump"
fi

# Create temporary database for validation
TEMP_DB="temp_restore_$(date +%s)"
echo "🗄️ Creating temporary database for validation: $TEMP_DB"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE $TEMP_DB;" || {
    echo "❌ Failed to create temporary database"
    exit 1
}

# Test restore to temporary database first
echo "🧪 Testing backup restoration to temporary database..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMP_DB" < "$BACKUP_FILE" 2>/dev/null; then
    echo "✅ Backup file validation successful"
    
    # Get record counts for verification
    TABLES_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEMP_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
    echo "📋 Tables found in backup: $TABLES_COUNT"
    
    # Clean up temporary database
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE $TEMP_DB;"
else
    echo "❌ Backup validation failed"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE $TEMP_DB;" 2>/dev/null || true
    exit 1
fi

# Backup existing database if it exists and has data
echo "🔄 Checking existing database..."
EXISTING_TABLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs || echo "0")

if [ "$EXISTING_TABLES" -gt "0" ]; then
    BACKUP_EXISTING="/var/lib/postgresql/backups/pre-restore-backup-$(date +%Y%m%d_%H%M%S).sql"
    echo "💾 Backing up existing database to: $BACKUP_EXISTING"
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_EXISTING"
    echo "✅ Existing database backed up"
fi

# Perform the actual restoration
echo "🔄 Starting database restoration to: $DB_NAME"
echo "⚠️ This will replace all existing data in the database"

# Drop existing connections to the database
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true

# Restore the database
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"; then
    echo "✅ Database restoration completed successfully"
    
    # Verify restoration
    RESTORED_TABLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
    echo "📊 Tables after restoration: $RESTORED_TABLES"
    
    # Log restoration details
    echo "📝 Restoration Summary:"
    echo "  - Source: $BACKUP_FILE ($BACKUP_SIZE)"
    echo "  - Target: $DB_NAME@$DB_HOST:$DB_PORT"
    echo "  - Tables: $RESTORED_TABLES"
    echo "  - Timestamp: $(date)"
    
    echo "🎉 Database restoration completed successfully!"
else
    echo "❌ Database restoration failed"
    
    # Restore from backup if available
    if [ -f "$BACKUP_EXISTING" ]; then
        echo "🔄 Attempting to restore from pre-restoration backup..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_EXISTING"
        echo "✅ Rolled back to previous state"
    fi
    
    exit 1
fi