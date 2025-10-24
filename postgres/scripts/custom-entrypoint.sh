#!/bin/bash
# Custom PostgreSQL entrypoint that ensures SSL is configured on every startup

set -e

echo "🚀 Starting PostgreSQL with SSL configuration..."

# Run SSL configuraton before PostgreSQL starts
if [ -f "/usr/local/bin/configure-ssl-startup.sh" ]; then
    echo "🔧 Configuring SSL..."
    /usr/local/bin/configure-ssl-startup.sh
else
    echo "⚠️ SSL configuration script not found"
fi

# Continue with the original PostgreSQL entrypoint
echo "🐘 Starting PostgreSQL..."
exec docker-entrypoint.sh "$@"