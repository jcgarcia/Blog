#!/bin/bash
# Database initialization script
# This runs automatically when the container starts for the first time

set -e

echo "🚀 Starting PostgreSQL database initialization..."

# Create the blog database if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Ensure the blog database exists
    SELECT 'Database already exists' WHERE EXISTS (SELECT FROM pg_database WHERE datname = 'blog');
    
    -- Create dedicated database connection users
    DO \$\$
    BEGIN
        -- Create CoreDBConnect user for CoreDB access
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'CoreDBConnect') THEN
            RAISE NOTICE 'User CoreDBConnect already exists';
        ELSE
            CREATE USER "CoreDBConnect" WITH PASSWORD '${POSTGRES_PASSWORD}';
            GRANT ALL PRIVILEGES ON DATABASE coredb TO "CoreDBConnect";
            RAISE NOTICE 'User CoreDBConnect created successfully';
        END IF;
        
        -- Create DataDBConnect user for DataDB access
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'DataDBConnect') THEN
            RAISE NOTICE 'User DataDBConnect already exists';
        ELSE
            CREATE USER "DataDBConnect" WITH PASSWORD '${BLOG_DB_PASSWORD:-blogpassword}';
            GRANT ALL PRIVILEGES ON DATABASE blog TO "DataDBConnect";
            RAISE NOTICE 'User DataDBConnect created successfully';
        END IF;
        
        -- Keep blogadmin for backward compatibility (legacy)
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'blogadmin') THEN
            RAISE NOTICE 'User blogadmin already exists';
        ELSE
            CREATE USER blogadmin WITH PASSWORD '${BLOG_DB_PASSWORD:-blogpassword}';
            GRANT ALL PRIVILEGES ON DATABASE blog TO blogadmin;
            RAISE NOTICE 'User blogadmin created successfully (legacy)';
        END IF;
    END
    \$\$;
    
    -- Set up basic extensions that might be needed
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    
    -- Log initialization completion
    SELECT 'PostgreSQL initialization completed successfully' as status;
EOSQL

echo "✅ Database initialization completed"

# Check if there's a backup file to restore from
if [ -f "/var/lib/postgresql/backups/initial-restore.sql" ]; then
    echo "🔄 Found backup file for restoration..."
    /usr/local/bin/restore-backup.sh /var/lib/postgresql/backups/initial-restore.sql
elif [ -f "/var/lib/postgresql/backups/latest-backup.sql" ]; then
    echo "🔄 Found latest backup file for restoration..."
    /usr/local/bin/restore-backup.sh /var/lib/postgresql/backups/latest-backup.sql
else
    echo "ℹ️ No backup file found, starting with empty database"
fi

echo "🎉 PostgreSQL container initialization complete!"