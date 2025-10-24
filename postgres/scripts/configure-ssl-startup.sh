#!/bin/bash
# PostgreSQL SSL setup script that runs on EVERY container startup
# This runs before PostgreSQL starts, ensuring SSL is always configured

set -e

echo "🔐 Checking and configuring PostgreSQL SSL..."

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
SSL_DIR="/var/lib/postgresql/ssl"

# Only proceed if PGDATA exists (database has been initialized)
if [ ! -d "$PGDATA" ] || [ ! -f "$PGDATA/postgresql.conf" ]; then
    echo "ℹ️ Database not yet initialized, SSL will be configured after first initialization"
    exit 0
fi

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

# Generate SSL certificates if they don't exist
if [ ! -f "$SSL_DIR/server.key" ] || [ ! -f "$SSL_DIR/server.crt" ]; then
    echo "📝 Generating SSL certificates..."
    cd "$SSL_DIR"
    
    # Generate private key
    openssl genrsa -out server.key 2048
    chmod 600 server.key
    chown postgres:postgres server.key
    
    # Generate self-signed certificate (valid for 365 days)
    openssl req -new -x509 -key server.key -out server.crt -days 365 \
        -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=localhost"
    chmod 644 server.crt
    chown postgres:postgres server.crt
    
    echo "✅ SSL certificates generated"
else
    echo "ℹ️ SSL certificates already exist"
fi

# Check if SSL is already configured in postgresql.conf
if ! grep -q "ssl = on" "$PGDATA/postgresql.conf"; then
    echo "📝 Adding SSL configuration to postgresql.conf..."
    cat >> "$PGDATA/postgresql.conf" << 'EOF'

# SSL Configuration - Added by configure-ssl-startup.sh
ssl = on
ssl_cert_file = '/var/lib/postgresql/ssl/server.crt'
ssl_key_file = '/var/lib/postgresql/ssl/server.key'
EOF
    echo "✅ SSL configuration added to postgresql.conf"
else
    echo "ℹ️ SSL already configured in postgresql.conf"
fi

# Ensure pg_hba.conf supports SSL connections
if ! grep -q "hostssl" "$PGDATA/pg_hba.conf"; then
    echo "📝 Updating pg_hba.conf for SSL support..."
    # Backup original
    cp "$PGDATA/pg_hba.conf" "$PGDATA/pg_hba.conf.backup"
    
    # Create new pg_hba.conf with SSL support
    cat > "$PGDATA/pg_hba.conf" << 'EOF'
# PostgreSQL Client Authentication Configuration File
# Updated by configure-ssl-startup.sh to support SSL

# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             all                                     trust

# IPv4 connections - prefer SSL but allow non-SSL for compatibility
hostssl all             all             127.0.0.1/32            md5
host    all             all             127.0.0.1/32            md5
hostssl all             all             0.0.0.0/0               md5
host    all             all             0.0.0.0/0               md5

# IPv6 connections - prefer SSL but allow non-SSL for compatibility  
hostssl all             all             ::1/128                 md5
host    all             all             ::1/128                 md5

# Allow replication connections from localhost
local   replication     all                                     trust
hostssl replication     all             127.0.0.1/32            md5
host    replication     all             127.0.0.1/32            md5
hostssl replication     all             ::1/128                 md5
host    replication     all             ::1/128                 md5

EOF
    echo "✅ pg_hba.conf updated for SSL support"
else
    echo "ℹ️ pg_hba.conf already supports SSL connections"
fi

# Set proper ownership for all files
chown postgres:postgres "$PGDATA/postgresql.conf" "$PGDATA/pg_hba.conf"
chown -R postgres:postgres "$SSL_DIR"

echo "🔐 SSL configuration completed successfully!"
echo "📋 SSL Configuration Status:"
echo "   - SSL Certificates: $(ls -la $SSL_DIR/server.* 2>/dev/null | wc -l) files"
echo "   - postgresql.conf: SSL $(grep -q 'ssl = on' $PGDATA/postgresql.conf && echo 'ENABLED' || echo 'DISABLED')"
echo "   - pg_hba.conf: SSL $(grep -q 'hostssl' $PGDATA/pg_hba.conf && echo 'CONFIGURED' || echo 'NOT CONFIGURED')"