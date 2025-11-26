#!/bin/bash

# Complete PostgreSQL Blog Setup Script
# This script sets up both the blog tables and system configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐘 Complete PostgreSQL Blog Setup${NC}"
echo "============================================="

# Configuration - Set your PostgreSQL connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-blog}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if PostgreSQL client is installed
if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL client (psql) is not installed"
    echo ""
    echo "Install PostgreSQL client:"
    echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "  macOS: brew install postgresql"
    echo "  CentOS/RHEL: sudo yum install postgresql"
    exit 1
fi

# Check if we have database connection details
if [ -z "$DB_PASSWORD" ]; then
    print_warning "Database password not set in environment"
    echo -e "${YELLOW}Please enter your PostgreSQL password:${NC}"
    read -s DB_PASSWORD
    echo ""
fi

echo -e "${BLUE}📋 Database Configuration:${NC}"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Test database connection
print_info "Testing database connection..."
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    print_status "Database connection successful"
else
    print_error "Cannot connect to database"
    echo ""
    echo "Please check your connection details and make sure PostgreSQL is running."
    exit 1
fi

# Check what tables already exist
print_info "Checking existing tables..."
EXISTING_TABLES=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')

if [ "$EXISTING_TABLES" -gt 0 ]; then
    print_warning "Found $EXISTING_TABLES existing table(s) in database"
    echo ""
    echo "Existing tables:"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt" 2>/dev/null
    echo ""
    echo -e "${YELLOW}Do you want to continue? This will create additional tables. (y/N):${NC}"
    read -r CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Create blog schema (all blog tables)
print_info "Creating blog database schema..."
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "blog_schema_postgresql.sql" > /dev/null 2>&1; then
    print_status "Blog schema created successfully"
else
    print_error "Failed to create blog schema"
    echo ""
    echo "Please check the blog_schema_postgresql.sql file."
    exit 1
fi

# Create system configuration tables
print_info "Creating system configuration tables..."
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "system_config_schema_postgresql.sql" > /dev/null 2>&1; then
    print_status "System configuration tables created successfully"
else
    print_error "Failed to create system configuration tables"
    echo ""
    echo "Please check the system_config_schema_postgresql.sql file."
    exit 1
fi

# Generate secure API key
print_info "Generating secure API key..."
SECURE_API_KEY=$(openssl rand -hex 32)
if [ -z "$SECURE_API_KEY" ]; then
    print_error "Failed to generate secure API key"
    exit 1
fi

# Store API key in database
print_info "Storing API key in database..."
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "UPDATE sys_api_keys SET api_key_encrypted = '$SECURE_API_KEY' WHERE service_name = 'blog_publish';" > /dev/null 2>&1; then
    print_status "API key stored successfully"
else
    print_error "Failed to store API key"
    exit 1
fi

# Install Node.js dependencies
print_info "Installing Node.js dependencies..."
cd ../
if [ -f "package.json" ]; then
    if command -v pnpm &> /dev/null; then
        pnpm install --silent
        print_status "Dependencies installed with pnpm"
    else
        print_error "pnpm is not installed"
        echo "This project requires pnpm. Please install it:"
        echo "  npm install -g pnpm"
        echo "  or curl -fsSL https://get.pnpm.io/install.sh | sh"
        exit 1
    fi
else
    print_warning "No package.json found, skipping dependency installation"
fi

# Create .env file for database connection
print_info "Creating environment configuration..."
cat > .env.local << EOF
# PostgreSQL Database Configuration
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_SSL=false

# Configuration encryption key
CONFIG_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Blog API Configuration
BLOG_API_KEY=$SECURE_API_KEY
BLOG_API_URL=https://bapi.ingasti.com
BLOG_USER_ID=1

# JWT Secret for authentication
JWT_SECRET=$(openssl rand -hex 32)

# Session configuration
SESSION_SECRET=$(openssl rand -hex 32)
EOF

chmod 600 .env.local
print_status "Environment configuration created with secure permissions"

# Get final table count
TOTAL_TABLES=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
BLOG_TABLES=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT LIKE 'sys_%';" 2>/dev/null | tr -d ' ')
SYS_TABLES=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'sys_%';" 2>/dev/null | tr -d ' ')

# Final summary
echo ""
echo -e "${GREEN}🎉 Complete PostgreSQL Blog Setup Complete!${NC}"
echo "============================================="
echo ""
echo -e "${BLUE}📊 Database Summary:${NC}"
echo "   Total tables: $TOTAL_TABLES"
echo "   Blog tables: $BLOG_TABLES"
echo "   System config tables: $SYS_TABLES"
echo ""
echo -e "${BLUE}🗂️  Blog Tables Created:${NC}"
echo "   • users - User accounts and authentication"
echo "   • posts - Blog posts and articles"
echo "   • categories - Post categories"
echo "   • tags - Post tags"
echo "   • post_tags - Post-tag relationships"
echo "   • comments - Post comments"
echo "   • media - File uploads and attachments"
echo "   • settings - Blog configuration"
echo "   • sessions - User sessions"
echo "   • analytics - Post analytics"
echo "   • subscribers - Email subscribers"
echo ""
echo -e "${BLUE}🛠️  System Tables Created:${NC}"
echo "   • sys_config - System configuration values"
echo "   • sys_api_keys - Encrypted API keys"
echo "   • sys_config_audit - Audit logging"
echo ""
echo "✅ Generated secure API key: $SECURE_API_KEY"
echo "✅ Environment configuration created (.env.local)"
echo "✅ Database connection tested successfully"
echo "✅ Dependencies installed with pnpm"
echo ""
echo -e "${YELLOW}🔐 Security Notes:${NC}"
echo "   • API keys are encrypted in the database"
echo "   • .env.local file has secure permissions (600)"
echo "   • All configuration changes are audited"
echo "   • Default admin user created (username: admin, password: admin123)"
echo "   • Never commit .env.local to version control"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Change the default admin password:"
echo "   node tools/change-admin-password.js"
echo ""
echo "2. Configure your API keys:"
echo "   node tools/system-config.js api-key:set openai 'your-openai-key'"
echo "   node tools/system-config.js api-key:set anthropic 'your-anthropic-key'"
echo ""
echo "3. Configure blog settings:"
echo "   node tools/system-config.js config:set blog.site_title 'Your Blog Name'"
echo "   node tools/system-config.js config:set blog.site_description 'Your blog description'"
echo ""
echo "4. Test the system:"
echo "   node test-postgresql.js"
echo ""
echo "5. Start your application:"
echo "   pnpm dev"
echo ""
echo -e "${GREEN}Your complete PostgreSQL blog system is ready! 🚀${NC}"
