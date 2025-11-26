#!/bin/bash
# Watch Folder Auto-Publisher
# Automatically publishes new markdown files added to a directory

set -e

# Configuration
WATCH_DIR="${1:-/home/jcgarcia/docs/blog/Tech/AWS}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLISHED_LOG="$SCRIPT_DIR/published.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}👁️  Watch Folder Auto-Publisher${NC}"
echo -e "${BLUE}================================${NC}"
echo "Watching directory: $WATCH_DIR"
echo "Press Ctrl+C to stop"
echo ""

# Check if inotify-tools is installed
if ! command -v inotifywait &> /dev/null; then
    echo -e "${RED}❌ inotifywait not found. Install it with:${NC}"
    echo "   Ubuntu/Debian: sudo apt-get install inotify-tools"
    echo "   CentOS/RHEL: sudo yum install inotify-tools"
    exit 1
fi

# Create published log if it doesn't exist
touch "$PUBLISHED_LOG"

# Function to check if file was already published
is_published() {
    local file="$1"
    grep -q "^$(basename "$file")$" "$PUBLISHED_LOG" 2>/dev/null
}

# Function to mark file as published
mark_published() {
    local file="$1"
    echo "$(basename "$file")" >> "$PUBLISHED_LOG"
}

# Function to publish file
publish_file() {
    local file="$1"
    local filename=$(basename "$file")
    
    echo -e "${BLUE}📝 New file detected: $filename${NC}"
    
    # Check if already published
    if is_published "$file"; then
        echo -e "${YELLOW}⚠️  File already published: $filename${NC}"
        return 0
    fi
    
    # Wait a moment for file to be completely written
    sleep 2
    
    # Check if file still exists and is readable
    if [ ! -r "$file" ]; then
        echo -e "${RED}❌ File not readable: $filename${NC}"
        return 1
    fi
    
    # Publish the file
    if "$SCRIPT_DIR/blog-publish" "$file"; then
        echo -e "${GREEN}✅ Successfully published: $filename${NC}"
        mark_published "$file"
        return 0
    else
        echo -e "${RED}❌ Failed to publish: $filename${NC}"
        return 1
    fi
}

# Main watch loop
echo -e "${GREEN}🔍 Starting to watch for new markdown files...${NC}"
echo ""

inotifywait -m -r -e create,moved_to --format '%w%f' "$WATCH_DIR" | while read file; do
    # Only process markdown files
    if [[ "$file" == *.md ]]; then
        publish_file "$file"
        echo ""
    fi
done
