#!/bin/bash
# Create backup script for containerized PostgreSQL
# Usage: create-backup.sh [backup_name]

set -e

# Configuration
DB_NAME="${POSTGRES_DB:-blog}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
BACKUP_DIR="/var/lib/postgresql/backups"

# Generate backup filename
if [ -n "$1" ]; then
    BACKUP_NAME="$1"
else
    BACKUP_NAME="backup-$(date +%Y-%m-%d_%H-%M-%S)"
fi

BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql"

echo "🚀 Starting database backup creation..."
echo "📊 Configuration:"
echo "  - Database: $DB_NAME@$DB_HOST:$DB_PORT"
echo "  - User: $DB_USER"
echo "  - Output: $BACKUP_FILE"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Check PostgreSQL connection
echo "🔍 Checking database connection..."
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; then
    echo "❌ PostgreSQL is not available"
    exit 1
fi

echo "✅ Database connection verified"

# Get database statistics before backup
echo "📈 Database statistics:"
TABLES_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
DB_SIZE=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" | xargs)

echo "  - Tables: $TABLES_COUNT"
echo "  - Size: $DB_SIZE"

# Create the backup
echo "💾 Creating database backup..."
START_TIME=$(date +%s)

if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
   --verbose \
   --no-password \
   --format=plain \
   --no-owner \
   --no-privileges \
   --create \
   --clean \
   > "$BACKUP_FILE" 2>/tmp/backup_log.txt; then
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    
    echo "✅ Backup created successfully!"
    echo "📊 Backup details:"
    echo "  - File: $BACKUP_FILE"
    echo "  - Size: $BACKUP_SIZE"
    echo "  - Duration: ${DURATION}s"
    
    # Verify backup integrity
    echo "🔍 Verifying backup integrity..."
    if head -20 "$BACKUP_FILE" | grep -q "PostgreSQL database dump"; then
        echo "✅ Backup file format verified"
    else
        echo "⚠️ Warning: Backup file format may be invalid"
    fi
    
    # Create latest backup symlink
    LATEST_LINK="$BACKUP_DIR/latest-backup.sql"
    ln -sf "$BACKUP_FILE" "$LATEST_LINK"
    echo "🔗 Latest backup link updated: $LATEST_LINK"
    
    # Log backup information
    echo "$(date): Created backup $BACKUP_FILE ($BACKUP_SIZE) in ${DURATION}s" >> "$BACKUP_DIR/backup_history.log"
    
    # Cleanup old backups (keep last 10)
    echo "🧹 Cleaning up old backups..."
    cd "$BACKUP_DIR"
    ls -t backup-*.sql 2>/dev/null | tail -n +11 | xargs rm -f || true
    OLD_COUNT=$(ls -1 backup-*.sql 2>/dev/null | wc -l)
    echo "📦 Backup files retained: $OLD_COUNT"
    
    echo "🎉 Backup process completed successfully!"
    
    # Output backup file path for scripts that might use it
    echo "$BACKUP_FILE"
    
else
    echo "❌ Backup creation failed"
    echo "📋 Error log:"
    cat /tmp/backup_log.txt || true
    exit 1
fi