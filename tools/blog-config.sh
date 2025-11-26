#!/bin/bash
# Blog Publishing Configuration Manager
# Sets up environment and manages publishing configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
CONFIG_FILE="$SCRIPT_DIR/publish-config.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_help() {
    echo -e "${BLUE}🔧 Blog Publishing Configuration Manager${NC}"
    echo -e "${BLUE}=========================================${NC}"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  setup     - Interactive setup wizard"
    echo "  config    - Show current configuration"
    echo "  test      - Test API connection"
    echo "  validate  - Validate markdown files"
    echo "  stats     - Show publishing statistics"
    echo "  help      - Show this help message"
    echo ""
    echo "Options:"
    echo "  --api-url <url>    Set API URL"
    echo "  --api-key <key>    Set API key"
    echo "  --user-id <id>     Set default user ID"
    echo ""
}

setup_wizard() {
    echo -e "${BLUE}🚀 Blog Publishing Setup Wizard${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
    
    # API URL
    echo -e "${YELLOW}Enter your blog API URL:${NC}"
    read -p "API URL [https://bapi.ingasti.com/api]: " api_url
    api_url=${api_url:-"https://bapi.ingasti.com/api"}
    
    # API Key
    echo -e "${YELLOW}Enter your API key:${NC}"
    read -s -p "API Key: " api_key
    echo ""
    
    # User ID
    echo -e "${YELLOW}Enter your default user ID:${NC}"
    read -p "User ID [1]: " user_id
    user_id=${user_id:-"1"}
    
    # Write to .env file
    cat > "$ENV_FILE" << EOF
# Blog Publishing Configuration
# Generated on $(date)
BLOG_API_URL=$api_url
BLOG_API_KEY=$api_key
BLOG_USER_ID=$user_id
EOF
    
    echo ""
    echo -e "${GREEN}✅ Configuration saved to $ENV_FILE${NC}"
    echo ""
    
    # Test connection
    echo -e "${BLUE}🔍 Testing API connection...${NC}"
    if test_connection; then
        echo -e "${GREEN}✅ API connection successful!${NC}"
    else
        echo -e "${RED}❌ API connection failed. Please check your configuration.${NC}"
    fi
}

show_config() {
    echo -e "${BLUE}📋 Current Configuration${NC}"
    echo -e "${BLUE}========================${NC}"
    echo ""
    
    if [ -f "$ENV_FILE" ]; then
        # Source the .env file and display (masking sensitive info)
        source "$ENV_FILE"
        echo -e "${GREEN}API URL:${NC} $BLOG_API_URL"
        echo -e "${GREEN}API Key:${NC} ${BLOG_API_KEY:0:8}..." 
        echo -e "${GREEN}User ID:${NC} $BLOG_USER_ID"
        echo -e "${GREEN}Config File:${NC} $ENV_FILE"
    else
        echo -e "${RED}❌ No configuration found. Run '$0 setup' first.${NC}"
    fi
}

test_connection() {
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}❌ No configuration found. Run '$0 setup' first.${NC}"
        return 1
    fi
    
    source "$ENV_FILE"
    
    # Test API connection
    response=$(curl -s -w "%{http_code}" -o /dev/null \
        -H "X-API-Key: $BLOG_API_KEY" \
        "$BLOG_API_URL/health" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        return 0
    else
        echo -e "${RED}HTTP Status: $response${NC}"
        return 1
    fi
}

validate_files() {
    local dir="${1:-/home/jcgarcia/docs/blog/Tech/AWS}"
    
    echo -e "${BLUE}📝 Validating Markdown Files${NC}"
    echo -e "${BLUE}=============================${NC}"
    echo "Directory: $dir"
    echo ""
    
    if [ ! -d "$dir" ]; then
        echo -e "${RED}❌ Directory not found: $dir${NC}"
        return 1
    fi
    
    local total=0
    local valid=0
    local invalid=0
    
    while IFS= read -r -d '' file; do
        ((total++))
        filename=$(basename "$file")
        
        # Check if file has frontmatter
        if head -n 1 "$file" | grep -q "^---$"; then
            # Extract frontmatter
            frontmatter=$(awk '/^---$/{p++} p==1&&/^title:/{t=1} p==1&&/^description:/{d=1} p==2{exit} END{if(t&&d) print "valid"; else print "invalid"}' "$file")
            
            if [ "$frontmatter" = "valid" ]; then
                echo -e "${GREEN}✅ $filename${NC}"
                ((valid++))
            else
                echo -e "${RED}❌ $filename - Missing required frontmatter (title, description)${NC}"
                ((invalid++))
            fi
        else
            echo -e "${RED}❌ $filename - No frontmatter found${NC}"
            ((invalid++))
        fi
    done < <(find "$dir" -name "*.md" -type f -print0)
    
    echo ""
    echo -e "${BLUE}📊 Validation Summary${NC}"
    echo -e "${BLUE}=====================${NC}"
    echo -e "${GREEN}✅ Valid: $valid${NC}"
    echo -e "${RED}❌ Invalid: $invalid${NC}"
    echo -e "${BLUE}📝 Total: $total${NC}"
    
    return $invalid
}

show_stats() {
    local log_file="$SCRIPT_DIR/published.log"
    
    echo -e "${BLUE}📊 Publishing Statistics${NC}"
    echo -e "${BLUE}========================${NC}"
    echo ""
    
    if [ -f "$log_file" ]; then
        local total=$(wc -l < "$log_file")
        local today=$(date +%Y-%m-%d)
        local today_count=$(grep -c "^.*$today" "$log_file" 2>/dev/null || echo "0")
        
        echo -e "${GREEN}Total published posts: $total${NC}"
        echo -e "${GREEN}Published today: $today_count${NC}"
        echo -e "${GREEN}Log file: $log_file${NC}"
        
        if [ $total -gt 0 ]; then
            echo ""
            echo -e "${BLUE}Recent publications:${NC}"
            tail -n 5 "$log_file" | while read -r line; do
                echo "  - $line"
            done
        fi
    else
        echo -e "${YELLOW}⚠️  No publishing log found${NC}"
    fi
}

# Main command processing
case "${1:-help}" in
    setup)
        setup_wizard
        ;;
    config)
        show_config
        ;;
    test)
        echo -e "${BLUE}🔍 Testing API connection...${NC}"
        if test_connection; then
            echo -e "${GREEN}✅ API connection successful!${NC}"
        else
            echo -e "${RED}❌ API connection failed${NC}"
            exit 1
        fi
        ;;
    validate)
        validate_files "$2"
        ;;
    stats)
        show_stats
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
