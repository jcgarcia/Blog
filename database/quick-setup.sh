#!/bin/bash

# 🚀 Quick Setup Script for Database-Based Configuration
# This script sets up the entire database configuration system

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 DATABASE CONFIGURATION SYSTEM SETUP${NC}"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [[ ! -f "system_config_schema.sql" ]]; then
    echo -e "${RED}❌ Please run this script from the database directory${NC}"
    echo "Expected: /home/jcgarcia/docs/Tech/Blog/code/database/"
    exit 1
fi

# Check environment variables
if [[ -z "${DB_HOST:-}" || -z "${DB_USER:-}" || -z "${DB_KEY:-}" ]]; then
    echo -e "${YELLOW}⚠️  Database environment variables not set${NC}"
    echo "Please set the following environment variables:"
    echo "  export DB_HOST=your-database-host"
    echo "  export DB_USER=your-database-user"
    echo "  export DB_KEY=your-database-password"
    echo ""
    echo -e "${BLUE}Loading from .env file...${NC}"
    
    if [[ -f "../api/.env" ]]; then
        source ../api/.env
        echo -e "${GREEN}✅ Environment variables loaded from .env${NC}"
    else
        echo -e "${RED}❌ No .env file found${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Database connection variables found${NC}"
echo "Host: $DB_HOST"
echo "User: $DB_USER"
echo ""

# Step 1: Create database schema
echo -e "${YELLOW}📋 Step 1: Creating database schema${NC}"
if mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_KEY" --ssl-mode=REQUIRED < system_config_schema.sql; then
    echo -e "${GREEN}✅ Database schema created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create database schema${NC}"
    exit 1
fi

# Step 2: Generate secure API key
echo -e "${YELLOW}🔑 Step 2: Generating secure API key${NC}"
SECURE_API_KEY=$(openssl rand -hex 32)
echo "Generated API key: ${SECURE_API_KEY:0:16}..."

# Step 3: Update API key in database
echo -e "${YELLOW}💾 Step 3: Storing API key in database${NC}"
if mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_KEY" --ssl-mode=REQUIRED system_config -e "UPDATE api_keys SET key_value = '$SECURE_API_KEY' WHERE key_name = 'blog_publish_api_key';"; then
    echo -e "${GREEN}✅ API key stored successfully${NC}"
else
    echo -e "${RED}❌ Failed to store API key${NC}"
    exit 1
fi

# Step 4: Install dependencies
echo -e "${YELLOW}📦 Step 4: Installing dependencies${NC}"
cd ../tools
if pnpm install; then
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Step 5: Test configuration
echo -e "${YELLOW}🧪 Step 5: Testing configuration${NC}"
if node system-config.js test; then
    echo -e "${GREEN}✅ Configuration test passed${NC}"
else
    echo -e "${RED}❌ Configuration test failed${NC}"
    exit 1
fi

# Step 6: Remove old .env files (security)
echo -e "${YELLOW}🧹 Step 6: Cleaning up old configuration files${NC}"
if [[ -f ".env.local" ]]; then
    echo -e "${YELLOW}Removing old .env.local file${NC}"
    rm .env.local
fi

# Update .gitignore to ensure no secrets are committed
echo -e "${YELLOW}📝 Step 7: Updating .gitignore${NC}"
cd ../..
if ! grep -q "# Database configuration" .gitignore; then
    echo "" >> .gitignore
    echo "# Database configuration" >> .gitignore
    echo ".env.local" >> .gitignore
    echo "*.env" >> .gitignore
    echo "config.json" >> .gitignore
    echo -e "${GREEN}✅ .gitignore updated${NC}"
else
    echo -e "${GREEN}✅ .gitignore already configured${NC}"
fi

# Success summary
echo ""
echo -e "${GREEN}🎉 SETUP COMPLETE!${NC}"
echo "==================="
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "✅ Database schema created"
echo "✅ API key generated and stored"
echo "✅ Dependencies installed"
echo "✅ Configuration tested"
echo "✅ Security files cleaned up"
echo ""

echo -e "${BLUE}🔑 Your API Key:${NC}"
echo "$SECURE_API_KEY"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Save this key securely!${NC}"
echo ""

echo -e "${BLUE}🚀 Next Steps:${NC}"
echo "1. Start your API server:"
echo "   cd code/api && npm start"
echo ""
echo "2. Test blog publishing:"
echo "   cd code/tools"
echo "   ./blog-publish --help"
echo ""
echo "3. Create a test post:"
echo "   echo '---' > test-post.md"
echo "   echo 'title: Test Post' >> test-post.md"
echo "   echo 'description: A test post' >> test-post.md"
echo "   echo '---' >> test-post.md"
echo "   echo '' >> test-post.md"
echo "   echo '# Hello World' >> test-post.md"
echo "   echo 'This is a test post.' >> test-post.md"
echo "   ./blog-publish test-post.md"
echo ""

echo -e "${BLUE}📚 Documentation:${NC}"
echo "- Database Config Guide: DATABASE_CONFIG_SYSTEM.md"
echo "- API Key Management: API_KEY_MANAGEMENT.md"
echo "- Quick Start: QUICK_START.md"
echo ""

echo -e "${GREEN}🔒 Your blog publishing system is now secure and ready!${NC}"
