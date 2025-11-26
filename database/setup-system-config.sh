#!/bin/bash

# 🔧 System Configuration Database Setup Script
# This script initializes the system configuration database with secure API keys

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 SYSTEM CONFIGURATION DATABASE SETUP${NC}"
echo "========================================"
echo ""

# Check if required environment variables are set
if [[ -z "${DB_HOST:-}" || -z "${DB_USER:-}" || -z "${DB_KEY:-}" ]]; then
    echo -e "${RED}❌ Missing required database environment variables${NC}"
    echo "Please set DB_HOST, DB_USER, and DB_KEY in your environment"
    exit 1
fi

echo -e "${GREEN}✅ Database connection variables found${NC}"
echo "Host: $DB_HOST"
echo "User: $DB_USER"
echo ""

# Generate secure API key
echo -e "${YELLOW}📝 Generating secure API key...${NC}"
SECURE_API_KEY=$(openssl rand -hex 32)
echo "Generated API key: ${SECURE_API_KEY:0:16}..."

# Create database schema
echo -e "${YELLOW}🗃️ Creating database schema...${NC}"
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_KEY" --ssl-mode=REQUIRED < system_config_schema.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database schema created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create database schema${NC}"
    exit 1
fi

# Update API key in the database
echo -e "${YELLOW}🔑 Setting up API key in database...${NC}"
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_KEY" --ssl-mode=REQUIRED system_config -e "
UPDATE api_keys 
SET key_value = '$SECURE_API_KEY' 
WHERE key_name = 'blog_publish_api_key';
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API key configured successfully${NC}"
else
    echo -e "${RED}❌ Failed to configure API key${NC}"
    exit 1
fi

# Create .env.local file for tools
echo -e "${YELLOW}📄 Creating .env.local file for tools...${NC}"
cat > ../tools/.env.local << EOF
# System Configuration Database API Key
# Generated on: $(date)
BLOG_API_KEY=$SECURE_API_KEY
BLOG_API_URL=https://bapi.ingasti.com/api
BLOG_USER_ID=1
EOF

echo -e "${GREEN}✅ .env.local file created in tools directory${NC}"

# Verify configuration
echo -e "${YELLOW}🔍 Verifying configuration...${NC}"
API_KEY_COUNT=$(mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_KEY" --ssl-mode=REQUIRED system_config -se "SELECT COUNT(*) FROM api_keys WHERE key_name = 'blog_publish_api_key' AND is_active = TRUE;")

if [ "$API_KEY_COUNT" -eq 1 ]; then
    echo -e "${GREEN}✅ Configuration verified successfully${NC}"
else
    echo -e "${RED}❌ Configuration verification failed${NC}"
    exit 1
fi

# Show configuration summary
echo ""
echo -e "${BLUE}📋 CONFIGURATION SUMMARY${NC}"
echo "========================"
echo "Database: system_config"
echo "API Key: Configured and active"
echo "Tools config: ../tools/.env.local"
echo ""

echo -e "${GREEN}🎉 SETUP COMPLETE!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Start your API server: cd ../api && npm start"
echo "2. Test the configuration: cd ../tools && ./blog-publish --help"
echo "3. Publish a test post: ./blog-publish your-post.md"
echo ""

echo -e "${RED}IMPORTANT SECURITY NOTES:${NC}"
echo "- The API key is stored securely in the database"
echo "- .env.local file is excluded from git (check .gitignore)"
echo "- Never commit API keys to version control"
echo "- Rotate API keys regularly for security"
echo ""

echo -e "${BLUE}API Key for reference:${NC}"
echo "$SECURE_API_KEY"
echo ""
echo -e "${YELLOW}Save this key securely - it won't be shown again!${NC}"
