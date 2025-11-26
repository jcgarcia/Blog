#!/bin/bash

# Database Migration Runner
# Purpose: Run database migrations in the correct order
# Usage: ./run-migrations.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_status() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

echo -e "${BLUE}🗃️  Database Migration Runner${NC}"
echo "=================================="

# Check if we have database connection details
if [ -z "$PGHOST" ] || [ -z "$PGDATABASE" ] || [ -z "$PGUSER" ]; then
    print_error "Missing database connection details"
    echo "Required environment variables:"
    echo "  PGHOST     - Database host"
    echo "  PGPORT     - Database port (default: 5432)"
    echo "  PGDATABASE - Database name"
    echo "  PGUSER     - Database user"
    echo "  PGPASSWORD - Database password"
    echo ""
    echo "These should be set as Jenkins credentials or environment variables"
    exit 1
fi

# Set defaults
PGPORT="${PGPORT:-5432}"

echo "📋 Database Configuration:"
echo "  Host: $PGHOST"
echo "  Port: $PGPORT"
echo "  Database: $PGDATABASE"
echo "  User: $PGUSER"
echo ""

# Test database connection
print_info "Testing database connection..."
if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1;" > /dev/null 2>&1; then
    print_status "Database connection successful"
else
    print_error "Cannot connect to database"
    exit 1
fi

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    print_error "Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Get list of migration files
MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name "*.sql" | sort)

if [ -z "$MIGRATION_FILES" ]; then
    print_warning "No migration files found in $MIGRATIONS_DIR"
    exit 0
fi

print_info "Found migrations:"
for file in $MIGRATION_FILES; do
    echo "  - $(basename "$file")"
done
echo ""

# Run each migration
MIGRATION_COUNT=0
SKIPPED_COUNT=0
APPLIED_COUNT=0

for migration_file in $MIGRATION_FILES; do
    MIGRATION_NAME=$(basename "$migration_file" .sql)
    print_info "Processing migration: $MIGRATION_NAME"
    
    # Check if migration was already applied
    APPLIED=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT COUNT(*) FROM migration_history WHERE migration_name = '$MIGRATION_NAME';" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$APPLIED" -gt "0" ]; then
        print_warning "Migration $MIGRATION_NAME already applied, skipping"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    else
        print_info "Applying migration: $MIGRATION_NAME"
        if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$migration_file" > /dev/null 2>&1; then
            print_status "Migration $MIGRATION_NAME applied successfully"
            APPLIED_COUNT=$((APPLIED_COUNT + 1))
        else
            print_error "Failed to apply migration: $MIGRATION_NAME"
            echo "Error details:"
            psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$migration_file"
            exit 1
        fi
    fi
    
    MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
done

echo ""
echo -e "${GREEN}🎉 Migration Summary${NC}"
echo "====================="
echo "  Total migrations: $MIGRATION_COUNT"
echo "  Applied: $APPLIED_COUNT"
echo "  Skipped: $SKIPPED_COUNT"
echo ""

if [ $APPLIED_COUNT -gt 0 ]; then
    print_status "Database migrations completed successfully!"
else
    print_info "All migrations were already applied"
fi

# Show migration history
print_info "Migration history:"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT migration_name, applied_at FROM migration_history ORDER BY applied_at;" 2>/dev/null || print_warning "Could not fetch migration history"