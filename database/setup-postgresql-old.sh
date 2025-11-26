#!/bin/bash

# PostgreSQL Database Setup Script for Blog Configuration System
# This script sets up the secure configuration system in your PostgreSQL database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SCHEMA_FILE="$SCRIPT_DIR/system_config_schema_postgresql.sql"

echo -e "${BLUE}🗃️  POSTGRESQL BLOG CONFIGURATION SETUP${NC}"
echo "Using PostgreSQL Database"
echo "========================="
echo ""

# Check if schema file exists
if [ ! -f "$SCHEMA_FILE" ]; then
    echo -e "${RED}❌ Schema file not found: $SCHEMA_FILE${NC}"
    exit 1
fi

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-blog}"
DB_USER="${DB_USER:-postgres}"

echo -e "${YELLOW}📋 Database Connection Details:${NC}"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Check if PostgreSQL client is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL client (psql) not found${NC}"
    echo "Please install PostgreSQL client:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "  macOS: brew install postgresql"
    echo "  Windows: Download from https://www.postgresql.org/download/"
    exit 1
fi

# Prompt for password if not set
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}🔐 Enter your PostgreSQL password:${NC}"
    read -s DB_PASSWORD
    echo ""
fi

# Test database connection
echo -e "${YELLOW}🔍 Testing database connection...${NC}"
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 'Connection successful' AS status;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "Please check your credentials and try again."
    exit 1
fi

# Run the schema setup
echo -e "${YELLOW}📋 Setting up system configuration tables...${NC}"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ System configuration tables created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create system configuration tables${NC}"
    exit 1
fi

# Generate secure API key
echo -e "${YELLOW}🔑 Generating secure API key...${NC}"
SECURE_API_KEY=$(openssl rand -hex 32)
echo "Generated API Key: $SECURE_API_KEY"

# Store API key in database
echo -e "${YELLOW}💾 Storing API key in database...${NC}"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "UPDATE sys_api_keys SET api_key_encrypted = '$SECURE_API_KEY' WHERE service_name = 'blog_publishing';"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API key stored successfully${NC}"
else
    echo -e "${RED}❌ Failed to store API key${NC}"
    exit 1
fi

# Verify tables were created
echo -e "${YELLOW}🔍 Verifying table creation...${NC}"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'sys_%' ORDER BY tablename;"

# Create environment file for tools
echo -e "${YELLOW}📝 Creating environment configuration...${NC}"
cat > "$SCRIPT_DIR/../tools/.env.local" << EOF
# PostgreSQL Database Configuration
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# Blog Configuration
BLOG_API_KEY=$SECURE_API_KEY
BLOG_API_URL=https://bapi.ingasti.com
BLOG_USER_ID=1

# Configuration Encryption Key
CONFIG_ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF

chmod 600 "$SCRIPT_DIR/../tools/.env.local"
echo -e "${GREEN}✅ Environment configuration created${NC}"

# Install Node.js dependencies
echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
cd "$SCRIPT_DIR/../tools"
if command -v pnpm &> /dev/null; then
    pnpm install pg
else
    npm install pg
fi

echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "================================================="
echo "Your PostgreSQL database now has secure system configuration tables:"
echo "  • sys_config - System configuration values"
echo "  • sys_api_keys - Encrypted API keys"
echo "  • sys_config_audit - Audit logging"
echo ""
echo "Your API Key: $SECURE_API_KEY"
echo ""
echo "Next steps:"
echo "1. Use the system-config.js tool to manage your configuration"
echo "2. Update your application to use the SystemConfigManager"
echo "3. Remove any .env files containing secrets"
echo ""
echo "Example commands:"
echo "  node tools/system-config.js set-api-key openai 'your-api-key-here'"
echo "  node tools/system-config.js set-config blog.default_author 'Your Name'"
echo "  node tools/system-config.js list-config"
echo ""
echo "Environment file created at: tools/.env.local"
echo ""
