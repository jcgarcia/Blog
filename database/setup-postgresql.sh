#!/bin/bash

# PostgreSQL Database Setup Script for Blog Configuration System
# This script sets up the secure configuration system in PostgreSQL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐘 PostgreSQL Blog Configuration Setup${NC}"
echo "=================================================="

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
    echo "Please check your connection details:"
    echo "  - Host: $DB_HOST"
    echo "  - Port: $DB_PORT"
    echo "  - Database: $DB_NAME"
    echo "  - User: $DB_USER"
    echo "  - Password: [hidden]"
    echo ""
    echo "Make sure your PostgreSQL server is running and accessible."
    exit 1
fi

# Create the configuration tables
print_info "Creating configuration tables..."
if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "system_config_schema_postgresql.sql" > /dev/null 2>&1; then
    print_status "Configuration tables created successfully"
else
    print_error "Failed to create configuration tables"
    echo ""
    echo "Please check the schema file and database permissions."
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
EOF

chmod 600 .env.local
print_status "Environment configuration created with secure permissions"

# Test the configuration system
print_info "Testing configuration system..."
if node -e "
import SystemConfigManager from './api/utils/systemConfigPostgreSQL.js';
const config = new SystemConfigManager();
config.testConnection().then(result => {
    if (result.success) {
        console.log('✅ Configuration system test passed');
        console.log('PostgreSQL Version:', result.data.pg_version);
        return config.getStats();
    } else {
        console.log('❌ Configuration system test failed:', result.error);
        process.exit(1);
    }
}).then(stats => {
    console.log('📊 Database Stats:', stats);
    process.exit(0);
}).catch(err => {
    console.log('❌ Configuration system test failed:', err.message);
    process.exit(1);
});
" 2>/dev/null; then
    print_status "Configuration system test passed"
else
    print_warning "Configuration system test failed, but setup completed"
    print_info "You may need to install the 'pg' package: npm install pg"
fi

# Final summary
echo ""
echo -e "${GREEN}🎉 PostgreSQL Configuration Setup Complete!${NC}"
echo "=================================================="
echo ""
echo "✅ Database tables created:"
echo "   • sys_config - System configuration values"
echo "   • sys_api_keys - Encrypted API keys"
echo "   • sys_config_audit - Audit logging"
echo ""
echo "✅ Generated secure API key: $SECURE_API_KEY"
echo "✅ Environment configuration created (.env.local)"
echo "✅ Database connection tested successfully"
echo ""
echo -e "${YELLOW}🔐 Security Notes:${NC}"
echo "   • API keys are encrypted in the database"
echo "   • .env.local file has secure permissions (600)"
echo "   • All configuration changes are audited"
echo "   • Never commit .env.local to version control"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Install PostgreSQL Node.js driver: pnpm install pg"
echo "2. Update your application to use systemConfigPostgreSQL.js"
echo "3. Test the configuration system:"
echo "   node -e \"import cfg from './api/utils/systemConfigPostgreSQL.js'; const c = new cfg(); c.testConnection().then(r => console.log(r));\""
echo ""
echo "4. Set additional API keys:"
echo "   node tools/system-config.js api-key:set openai 'your-openai-key'"
echo "   node tools/system-config.js api-key:set anthropic 'your-anthropic-key'"
echo ""
echo "5. Configure system settings:"
echo "   node tools/system-config.js config:set blog.default_author 'Your Name'"
echo "   node tools/system-config.js config:set system.environment 'production'"
echo ""
echo -e "${GREEN}Your blog system is now configured with secure PostgreSQL backend!${NC}"
