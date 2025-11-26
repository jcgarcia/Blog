#!/bin/bash
# Health check script for PostgreSQL container
# Used by Docker/Kubernetes health checks

set -e

# Configuration
DB_NAME="${POSTGRES_DB:-blog}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
TIMEOUT=10

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Basic PostgreSQL connectivity check
log "🔍 Checking PostgreSQL connectivity..."
if ! timeout $TIMEOUT pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q; then
    log "❌ PostgreSQL is not ready"
    exit 1
fi

log "✅ PostgreSQL is accepting connections"

# Database accessibility check
log "🔍 Checking database accessibility..."
if ! timeout $TIMEOUT psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    log "❌ Cannot access database '$DB_NAME'"
    exit 1
fi

log "✅ Database '$DB_NAME' is accessible"

# Check if essential tables exist (basic schema validation)
log "🔍 Validating database schema..."
ESSENTIAL_TABLES="posts users media"
MISSING_TABLES=""

for table in $ESSENTIAL_TABLES; do
    if ! timeout $TIMEOUT psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 FROM information_schema.tables WHERE table_name='$table';" | grep -q "1" 2>/dev/null; then
        MISSING_TABLES="$MISSING_TABLES $table"
    fi
done

if [ -n "$MISSING_TABLES" ]; then
    log "⚠️ Warning: Some tables are missing:$MISSING_TABLES"
    # Don't fail health check for missing tables in case of fresh installation
else
    log "✅ Essential database tables are present"
fi

# Check database performance (simple query response time)
log "🔍 Checking database performance..."
START_TIME=$(date +%s%N)
if timeout $TIMEOUT psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM information_schema.tables;" > /dev/null 2>&1; then
    END_TIME=$(date +%s%N)
    RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 )) # Convert to milliseconds
    
    if [ $RESPONSE_TIME -gt 5000 ]; then # 5 seconds
        log "⚠️ Warning: Slow database response time: ${RESPONSE_TIME}ms"
    else
        log "✅ Database response time: ${RESPONSE_TIME}ms"
    fi
else
    log "❌ Database performance check failed"
    exit 1
fi

# Check disk space for data directory
log "🔍 Checking disk space..."
DATA_DIR="/var/lib/postgresql/data"
if [ -d "$DATA_DIR" ]; then
    DISK_USAGE=$(df "$DATA_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 90 ]; then
        log "⚠️ Warning: High disk usage: ${DISK_USAGE}%"
    else
        log "✅ Disk usage: ${DISK_USAGE}%"
    fi
fi

# Check backup directory
log "🔍 Checking backup directory..."
BACKUP_DIR="/var/lib/postgresql/backups"
if [ -d "$BACKUP_DIR" ]; then
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.sql 2>/dev/null | wc -l || echo "0")
    log "📦 Backup files available: $BACKUP_COUNT"
else
    log "⚠️ Warning: Backup directory not found"
fi

# Advanced health metrics (optional, don't fail on these)
log "📊 Collecting health metrics..."

# Connection count
CONNECTIONS=$(timeout $TIMEOUT psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_stat_activity;" 2>/dev/null | xargs || echo "unknown")
log "🔗 Active connections: $CONNECTIONS"

# Database size
DB_SIZE=$(timeout $TIMEOUT psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null | xargs || echo "unknown")
log "💾 Database size: $DB_SIZE"

# Last backup check
if [ -f "$BACKUP_DIR/latest-backup.sql" ]; then
    LAST_BACKUP=$(stat -c %Y "$BACKUP_DIR/latest-backup.sql" 2>/dev/null || echo "0")
    CURRENT_TIME=$(date +%s)
    BACKUP_AGE=$(( (CURRENT_TIME - LAST_BACKUP) / 3600 )) # Hours
    log "🕒 Last backup: ${BACKUP_AGE} hours ago"
    
    if [ $BACKUP_AGE -gt 48 ]; then # More than 48 hours
        log "⚠️ Warning: Backup is older than 48 hours"
    fi
else
    log "⚠️ Warning: No recent backup found"
fi

log "🎉 PostgreSQL health check passed"
exit 0