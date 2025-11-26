#!/bin/bash
# Bulk Blog Post Publisher
# Usage: ./bulk-publish.sh [directory] [pattern]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOG_DIR="${1:-/home/jcgarcia/docs/blog/Tech/AWS}"
PATTERN="${2:-*.md}"
DELAY="${3:-2}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📚 Bulk Blog Post Publisher${NC}"
echo -e "${BLUE}==============================${NC}"
echo "Directory: $BLOG_DIR"
echo "Pattern: $PATTERN"
echo "Delay: ${DELAY}s between posts"
echo ""

# Check if directory exists
if [ ! -d "$BLOG_DIR" ]; then
    echo -e "${RED}❌ Directory not found: $BLOG_DIR${NC}"
    exit 1
fi

# Find all markdown files
files=($(find "$BLOG_DIR" -name "$PATTERN" -type f))

if [ ${#files[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No files found matching pattern: $PATTERN${NC}"
    exit 0
fi

echo -e "${GREEN}Found ${#files[@]} files to publish:${NC}"
for file in "${files[@]}"; do
    echo "  - $(basename "$file")"
done
echo ""

# Confirm before proceeding
read -p "Do you want to proceed? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Cancelled by user${NC}"
    exit 0
fi

# Publish files
success_count=0
error_count=0

for file in "${files[@]}"; do
    echo -e "${BLUE}📝 Publishing: $(basename "$file")${NC}"
    
    if "$SCRIPT_DIR/blog-publish" "$file"; then
        echo -e "${GREEN}✅ Successfully published: $(basename "$file")${NC}"
        ((success_count++))
    else
        echo -e "${RED}❌ Failed to publish: $(basename "$file")${NC}"
        ((error_count++))
    fi
    
    # Add delay between publications (except for the last one)
    if [ "$file" != "${files[-1]}" ]; then
        echo -e "${YELLOW}⏳ Waiting ${DELAY}s before next publication...${NC}"
        sleep "$DELAY"
    fi
    
    echo ""
done

# Summary
echo -e "${BLUE}📊 Publication Summary${NC}"
echo -e "${BLUE}=====================${NC}"
echo -e "${GREEN}✅ Successful: $success_count${NC}"
echo -e "${RED}❌ Failed: $error_count${NC}"
echo -e "${BLUE}📝 Total: $((success_count + error_count))${NC}"

if [ $error_count -gt 0 ]; then
    exit 1
fi
