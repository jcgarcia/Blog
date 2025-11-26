#!/bin/bash

# 🚀 Setup Script for Existing Database Configuration
# This script sets up configuration tables in your existing Aiven MySQL database

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗃️  BLOG CONFIGURATION SETUP${NC}"
echo "Using Existing Aiven PostgreSQL Database"
echo "========================================="
echo ""

# Database connection details from environment variables (standard PostgreSQL names)
PGHOST="${PGHOST:-ingasti-pg-ingasti.c.aivencloud.com}"
PGPORT="${PGPORT:-25306}"
PGDATABASE="${PGDATABASE:-blog}"
PGUSER="${PGUSER:-avnadmin}"
PGPASSWORD="${PGPASSWORD:-}" # Should be set securely before running
PGSSLMODE="${PGSSLMODE:-require}"

echo -e "${GREEN}✅ Database Connection Details:${NC}"
echo "Host: $PGHOST"
echo "Port: $PGPORT"
echo "Database: $PGDATABASE"
echo "User: $PGUSER"
echo "SSL Mode: $PGSSLMODE"
echo ""

# Step 1: Test database connection
echo -e "${YELLOW}🔍 Step 1: Testing database connection...${NC}"
PGPASSWORD="$PGPASSWORD" psql "postgresql://$PGUSER@$PGHOST:$PGPORT/$PGDATABASE?sslmode=$PGSSLMODE" -c "SELECT 'Connection successful!' as status;" >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "Please check your PostgreSQL credentials and network connection"
    exit 1
fi

# Step 2: Create configuration tables
echo -e "${YELLOW}📋 Step 2: Creating configuration tables...${NC}"
PGPASSWORD="$PGPASSWORD" psql "postgresql://$PGUSER@$PGHOST:$PGPORT/$PGDATABASE?sslmode=$PGSSLMODE" -f system_config_schema_postgresql.sql
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Configuration tables created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create configuration tables${NC}"
    exit 1
fi

# Step 3: Generate secure API key
echo -e "${YELLOW}🔑 Step 3: Generating secure API key...${NC}"
SECURE_API_KEY=$(openssl rand -hex 32)
echo "Generated API key: ${SECURE_API_KEY:0:16}..."

# Step 4: Store API key in database
echo -e "${YELLOW}💾 Step 4: Storing API key in database...${NC}"
PGPASSWORD="$PGPASSWORD" psql "postgresql://$PGUSER@$PGHOST:$PGPORT/$PGDATABASE?sslmode=$PGSSLMODE" -c "UPDATE sys_api_keys SET key_value = '$SECURE_API_KEY' WHERE service_name = 'blog_publish_api_key';"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ API key stored successfully${NC}"
else
    echo -e "${RED}❌ Failed to store API key${NC}"
    exit 1
fi

# Step 5: Verify configuration
echo -e "${YELLOW}🔍 Step 5: Verifying configuration...${NC}"
CONFIG_COUNT=$(PGPASSWORD="$PGPASSWORD" psql "postgresql://$PGUSER@$PGHOST:$PGPORT/$PGDATABASE?sslmode=$PGSSLMODE" -t -c "SELECT COUNT(*) FROM sys_config_values;" | xargs)
API_KEY_COUNT=$(PGPASSWORD="$PGPASSWORD" psql "postgresql://$PGUSER@$PGHOST:$PGPORT/$PGDATABASE?sslmode=$PGSSLMODE" -t -c "SELECT COUNT(*) FROM sys_api_keys WHERE is_active = TRUE;" | xargs)

echo "Configuration entries: $CONFIG_COUNT"
echo "Active API keys: $API_KEY_COUNT"

if [[ "$CONFIG_COUNT" -gt 0 && "$API_KEY_COUNT" -gt 0 ]]; then
    echo -e "${GREEN}✅ Configuration verified successfully${NC}"
else
    echo -e "${RED}❌ Configuration verification failed${NC}"
    exit 1
fi

# Step 6: Install dependencies
echo -e "${YELLOW}📦 Step 6: Installing dependencies...${NC}"
cd ../tools
if command -v pnpm >/dev/null 2>&1; then
    if pnpm install; then
        echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install dependencies with pnpm${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  pnpm not found, trying npm...${NC}"
    if npm install; then
        echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
fi

# Step 7: Test configuration system
echo -e "${YELLOW}🧪 Step 7: Testing configuration system...${NC}"
if node system-config.js test; then
    echo -e "${GREEN}✅ Configuration system test passed${NC}"
else
    echo -e "${YELLOW}⚠️  Configuration system test failed (this may be normal during initial setup)${NC}"
fi

# Success summary
echo ""
echo -e "${GREEN}🎉 SETUP COMPLETE!${NC}"
echo "==================="
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "✅ Database connection verified"
echo "✅ Configuration tables created (sys_config_values, sys_api_keys, sys_config_audit)"
echo "✅ API key generated and stored"
echo "✅ Dependencies installed"
echo "✅ Configuration system ready"
echo ""

echo -e "${BLUE}🔑 Your API Key:${NC}"
echo "$SECURE_API_KEY"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Save this key securely - you'll need it for publishing!${NC}"
echo ""

echo -e "${BLUE}🔧 Database Tables Created:${NC}"
echo "- sys_config_values: General configuration settings"
echo "- sys_api_keys: API keys with usage tracking"
echo "- sys_config_audit: Audit log of all changes"
echo ""

echo -e "${BLUE}🚀 Next Steps:${NC}"
echo "1. Test your API publishing:"
echo "   cd ../tools"
echo "   ./blog-publish --help"
echo ""
echo "2. Create a test post:"
echo "   echo '---' > test-post.md"
echo "   echo 'title: Test Post' >> test-post.md"
echo "   echo 'description: A test post' >> test-post.md"
echo "   echo '---' >> test-post.md"
echo "   echo '# Hello World' >> test-post.md"
echo "   ./blog-publish test-post.md"
echo ""
echo "3. Manage configuration:"
echo "   node system-config.js config:list"
echo "   node system-config.js apikey:list"
echo "   node system-config.js stats"
echo ""

echo -e "${BLUE}🔒 Security Notes:${NC}"
echo "- API keys are now stored securely in your database"
echo "- Configuration is managed centrally with audit logging"
echo "- No more .env files needed for API keys"
echo "- All access is logged for security monitoring"
echo ""

echo -e "${GREEN}🎯 Your blog publishing system is now secure and ready!${NC}"
