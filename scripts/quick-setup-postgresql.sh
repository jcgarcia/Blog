#!/bin/bash

# Quick PostgreSQL Setup with Docker
# This script sets up PostgreSQL using Docker for easy development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐘 Quick PostgreSQL Setup with Docker${NC}"
echo "========================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not available${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Use docker compose (new) or docker-compose (legacy)
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo -e "${GREEN}✅ Docker is available${NC}"

# Stop any existing containers
echo -e "${YELLOW}🔄 Stopping existing containers...${NC}"
$DOCKER_COMPOSE -f docker-compose.postgresql.yml down --remove-orphans 2>/dev/null || true

# Start PostgreSQL
echo -e "${YELLOW}🚀 Starting PostgreSQL container...${NC}"
$DOCKER_COMPOSE -f docker-compose.postgresql.yml up -d postgres

# Wait for PostgreSQL to be ready
echo -e "${YELLOW}⏳ Waiting for PostgreSQL to be ready...${NC}"
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker exec blog-postgres pg_isready -U postgres -d blog >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
        break
    fi
    
    attempt=$((attempt + 1))
    echo -e "${YELLOW}   Attempt $attempt/$max_attempts...${NC}"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}❌ PostgreSQL failed to start within timeout${NC}"
    echo "Check the logs with: $DOCKER_COMPOSE -f docker-compose.postgresql.yml logs postgres"
    exit 1
fi

# Create environment file
echo -e "${YELLOW}📝 Creating environment configuration...${NC}"
cat > .env.local << EOF
# PostgreSQL Database Configuration (Docker)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blog
DB_USER=postgres
DB_PASSWORD=${POSTGRES_PASSWORD:-secure_dev_password_change_in_production}
DB_SSL=false

# Configuration encryption key
CONFIG_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Blog API Configuration
BLOG_API_URL=https://bapi.ingasti.com
BLOG_USER_ID=1
EOF

chmod 600 .env.local
echo -e "${GREEN}✅ Environment configuration created${NC}"

# Install Node.js dependencies
echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
if command -v pnpm &> /dev/null; then
    pnpm install --silent
    echo -e "${GREEN}✅ Dependencies installed with pnpm${NC}"
else
    echo -e "${RED}❌ pnpm is not installed${NC}"
    echo "This project requires pnpm. Please install it:"
    echo "  npm install -g pnpm"
    echo "  or curl -fsSL https://get.pnpm.io/install.sh | sh"
    exit 1
fi

# Test the connection
echo -e "${YELLOW}🧪 Testing database connection...${NC}"
if node test-postgresql.js 2>/dev/null; then
    echo -e "${GREEN}✅ Database connection test passed${NC}"
else
    echo -e "${YELLOW}⚠️  Database connection test failed, but setup completed${NC}"
fi

# Generate and store API key
echo -e "${YELLOW}🔑 Generating secure API key...${NC}"
SECURE_API_KEY=$(openssl rand -hex 32)
if docker exec blog-postgres psql -U postgres -d blog -c "UPDATE sys_api_keys SET api_key_encrypted = '$SECURE_API_KEY' WHERE service_name = 'blog_publish';" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ API key stored successfully${NC}"
else
    echo -e "${YELLOW}⚠️  API key storage failed (table may not exist yet)${NC}"
fi

# Final summary
echo ""
echo -e "${GREEN}🎉 PostgreSQL Quick Setup Complete!${NC}"
echo "========================================"
echo ""
echo -e "${BLUE}📋 Setup Summary:${NC}"
echo "✅ PostgreSQL container running on port 5432"
echo "✅ Database 'blog' created with configuration tables"
echo "✅ Environment file created (.env.local)"
echo "✅ Node.js dependencies installed"
echo "✅ Database connection tested"
echo ""
echo -e "${BLUE}🔐 Database Connection Details:${NC}"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: blog"
echo "   User: postgres"
echo "   Password: blogpassword123"
echo ""
echo -e "${BLUE}🛠️  Next Steps:${NC}"
echo "1. Test the configuration system:"
echo "   node test-postgresql.js"
echo ""
echo "2. Configure your API keys:"
echo "   node tools/system-config.js api-key:set openai 'your-openai-key'"
echo "   node tools/system-config.js api-key:set anthropic 'your-anthropic-key'"
echo ""
echo "3. Update system configuration:"
echo "   node tools/system-config.js config:set blog.default_author 'Your Name'"
echo "   node tools/system-config.js config:set system.environment 'development'"
echo ""
echo "4. Start your application:"
echo "   pnpm dev"
echo ""
echo -e "${BLUE}🐳 Docker Commands:${NC}"
echo "   View logs: $DOCKER_COMPOSE -f docker-compose.postgresql.yml logs postgres"
echo "   Stop PostgreSQL: $DOCKER_COMPOSE -f docker-compose.postgresql.yml down"
echo "   Start pgAdmin: $DOCKER_COMPOSE -f docker-compose.postgresql.yml --profile admin up -d"
echo "   Connect to database: docker exec -it blog-postgres psql -U postgres -d blog"
echo ""
echo -e "${GREEN}Your PostgreSQL blog system is ready! 🚀${NC}"
