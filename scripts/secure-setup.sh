#!/bin/bash
# Secure API Key Setup Script
# This script helps you set up API keys securely without committing them to version control

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Secure API Key Setup${NC}"
echo -e "${BLUE}======================${NC}"
echo ""

# Function to generate secure API key
generate_api_key() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    elif command -v node &> /dev/null; then
        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    else
        echo -e "${RED}❌ Neither openssl nor node found. Please install one of them.${NC}"
        exit 1
    fi
}

# Function to validate API key
validate_api_key() {
    local key="$1"
    
    # Check length
    if [[ ${#key} -lt 64 ]]; then
        echo -e "${RED}❌ API key too short (${#key} characters, minimum 64)${NC}"
        return 1
    fi
    
    # Check for common weak patterns
    if [[ "$key" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}❌ API key contains only numbers${NC}"
        return 1
    fi
    
    if [[ "$key" =~ ^[a-zA-Z]+$ ]]; then
        echo -e "${RED}❌ API key contains only letters${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ API key validation passed${NC}"
    return 0
}

# Main setup function
setup_api_key() {
    echo -e "${YELLOW}Choose setup method:${NC}"
    echo "1. Generate new API key"
    echo "2. Use existing API key"
    echo "3. Exit"
    echo ""
    
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1)
            echo -e "${BLUE}Generating new API key...${NC}"
            API_KEY=$(generate_api_key)
            echo -e "${GREEN}Generated API key: ${API_KEY:0:8}...${NC}"
            ;;
        2)
            echo -e "${BLUE}Enter your existing API key:${NC}"
            read -s -p "API Key: " API_KEY
            echo ""
            if ! validate_api_key "$API_KEY"; then
                echo -e "${RED}❌ Invalid API key. Please try again.${NC}"
                return 1
            fi
            ;;
        3)
            echo -e "${YELLOW}Setup cancelled.${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid choice. Please select 1, 2, or 3.${NC}"
            return 1
            ;;
    esac
}

# Function to create .env.local file
create_env_local() {
    local env_file="$1"
    local api_key="$2"
    
    echo -e "${BLUE}Creating ${env_file}...${NC}"
    
    # Get additional configuration
    echo -e "${YELLOW}Enter additional configuration:${NC}"
    read -p "Blog User ID [1]: " user_id
    user_id=${user_id:-1}
    
    read -p "JWT Secret (leave empty to generate): " jwt_secret
    if [[ -z "$jwt_secret" ]]; then
        jwt_secret=$(generate_api_key)
        echo -e "${GREEN}Generated JWT secret${NC}"
    fi
    
    # Create the file
    cat > "$env_file" << EOF
# 🔐 SECURE CONFIGURATION - DO NOT COMMIT TO VERSION CONTROL
# Generated on $(date)
# 
# This file contains sensitive information and should never be committed
# to version control. It is included in .gitignore for security.

# API Configuration
PUBLISH_API_KEY=${api_key}
BLOG_USER_ID=${user_id}
JWT_SECRET=${jwt_secret}

# Environment
NODE_ENV=development

# Database (if needed)
# DB_HOST=localhost
# DB_USER=your-db-user
# DB_PASSWORD=your-db-password
# DB_NAME=your-db-name
EOF
    
    # Set secure permissions
    chmod 600 "$env_file"
    
    echo -e "${GREEN}✅ ${env_file} created successfully${NC}"
    echo -e "${YELLOW}⚠️  File permissions set to 600 (owner read/write only)${NC}"
}

# Function to update .gitignore
update_gitignore() {
    local gitignore_file="$1"
    
    if [[ -f "$gitignore_file" ]]; then
        # Check if security section already exists
        if grep -q "# 🔐 SECURITY:" "$gitignore_file"; then
            echo -e "${GREEN}✅ .gitignore already contains security rules${NC}"
            return 0
        fi
    fi
    
    echo -e "${BLUE}Updating .gitignore for security...${NC}"
    
    cat >> "$gitignore_file" << 'EOF'

# 🔐 SECURITY: Environment files with secrets
.env
.env.local
.env.*.local
*.env
.envrc

# 🔐 SECURITY: Secret files and directories
secrets/
config/secrets
private/
keys/
certificates/

# 🔐 SECURITY: Backup files that might contain secrets
*.bak
*.backup
*.orig
EOF
    
    echo -e "${GREEN}✅ .gitignore updated with security rules${NC}"
}

# Function to install dependencies
install_dependencies() {
    local package_dir="$1"
    
    if [[ -f "$package_dir/package.json" ]]; then
        echo -e "${BLUE}Installing dependencies in $package_dir...${NC}"
        
        cd "$package_dir"
        
        if command -v pnpm &> /dev/null; then
            pnpm install
        elif command -v npm &> /dev/null; then
            npm install
        else
            echo -e "${RED}❌ Neither pnpm nor npm found. Please install one of them.${NC}"
            return 1
        fi
        
        echo -e "${GREEN}✅ Dependencies installed${NC}"
        cd - > /dev/null
    fi
}

# Function to test configuration
test_configuration() {
    local env_file="$1"
    
    echo -e "${BLUE}Testing configuration...${NC}"
    
    # Source the environment file
    if [[ -f "$env_file" ]]; then
        source "$env_file"
    else
        echo -e "${RED}❌ Environment file not found: $env_file${NC}"
        return 1
    fi
    
    # Test API key
    if [[ -z "$PUBLISH_API_KEY" ]]; then
        echo -e "${RED}❌ PUBLISH_API_KEY not set${NC}"
        return 1
    fi
    
    if ! validate_api_key "$PUBLISH_API_KEY"; then
        return 1
    fi
    
    echo -e "${GREEN}✅ Configuration test passed${NC}"
    return 0
}

# Main execution
main() {
    echo -e "${YELLOW}🚨 IMPORTANT: This script creates secure configuration files${NC}"
    echo -e "${YELLOW}   These files will NOT be committed to version control${NC}"
    echo ""
    
    # Get the script directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    API_DIR="$SCRIPT_DIR/api"
    TOOLS_DIR="$SCRIPT_DIR/tools"
    
    # Setup API key
    while ! setup_api_key; do
        echo -e "${YELLOW}Please try again...${NC}"
        echo ""
    done
    
    # Create .env.local for API
    if [[ -d "$API_DIR" ]]; then
        create_env_local "$API_DIR/.env.local" "$API_KEY"
        update_gitignore "$API_DIR/.gitignore"
        install_dependencies "$API_DIR"
    else
        echo -e "${YELLOW}⚠️  API directory not found: $API_DIR${NC}"
    fi
    
    # Create .env.local for tools
    if [[ -d "$TOOLS_DIR" ]]; then
        echo -e "${BLUE}Setting up tools configuration...${NC}"
        
        # Get API URL
        read -p "API URL [https://bapi.ingasti.com/api]: " api_url
        api_url=${api_url:-"https://bapi.ingasti.com/api"}
        
        cat > "$TOOLS_DIR/.env.local" << EOF
# 🔐 SECURE CONFIGURATION - DO NOT COMMIT TO VERSION CONTROL
# Generated on $(date)

# Client Configuration
BLOG_API_URL=${api_url}
BLOG_API_KEY=${API_KEY}
BLOG_USER_ID=${user_id}
EOF
        
        chmod 600 "$TOOLS_DIR/.env.local"
        echo -e "${GREEN}✅ Tools configuration created${NC}"
        
        update_gitignore "$TOOLS_DIR/.gitignore"
        install_dependencies "$TOOLS_DIR"
    else
        echo -e "${YELLOW}⚠️  Tools directory not found: $TOOLS_DIR${NC}"
    fi
    
    # Update main .gitignore
    update_gitignore "$SCRIPT_DIR/.gitignore"
    
    # Test configuration
    if [[ -f "$API_DIR/.env.local" ]]; then
        test_configuration "$API_DIR/.env.local"
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Secure setup completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 What was created:${NC}"
    echo -e "   • $API_DIR/.env.local (API configuration)"
    echo -e "   • $TOOLS_DIR/.env.local (Tools configuration)"
    echo -e "   • Updated .gitignore files"
    echo -e "   • Installed dependencies"
    echo ""
    echo -e "${YELLOW}🔐 Security Notes:${NC}"
    echo -e "   • Configuration files are set to 600 permissions (owner only)"
    echo -e "   • Files are added to .gitignore to prevent commits"
    echo -e "   • API keys are cryptographically secure"
    echo ""
    echo -e "${BLUE}🚀 Next Steps:${NC}"
    echo -e "   1. Start your API server: cd api && npm run dev"
    echo -e "   2. Test the setup: cd tools && ./blog-config.sh test"
    echo -e "   3. Publish your first post: ./blog-publish your-post.md"
    echo ""
}

# Run main function
main "$@"
