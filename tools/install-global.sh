#!/bin/bash
# Global Installation Script for Bedtime Blog Publishing Tool
# Run this script to install the blog-publish tool globally

set -e  # Exit on any error

echo "🚀 Installing Bedtime Blog Publishing Tool Globally..."
echo "======================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR"

echo -e "${BLUE}📂 Tools directory: $TOOLS_DIR${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js v18+ first.${NC}"
    echo "Visit: https://nodejs.org"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}⚠️  Warning: Node.js version is $NODE_VERSION. Recommended: v18+${NC}"
fi

echo -e "${GREEN}✅ Node.js version: $(node --version)${NC}"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}📦 pnpm not found. Installing pnpm...${NC}"
    npm install -g pnpm
    echo -e "${GREEN}✅ pnpm installed successfully${NC}"
else
    echo -e "${GREEN}✅ pnpm version: $(pnpm --version)${NC}"
fi

# Navigate to tools directory
cd "$TOOLS_DIR"

# Install dependencies
echo -e "${BLUE}📥 Installing dependencies...${NC}"
pnpm install

# Make scripts executable
echo -e "${BLUE}🔧 Making scripts executable...${NC}"
chmod +x blog-publish.js
chmod +x system-config.js
if [ -f "blog-publish" ]; then
    chmod +x blog-publish
fi

# Method 1: Try global pnpm install
echo -e "${BLUE}🌍 Installing globally with pnpm...${NC}"
if pnpm install -g . 2>/dev/null; then
    echo -e "${GREEN}✅ Successfully installed globally with pnpm${NC}"
    INSTALL_METHOD="pnpm"
else
    echo -e "${YELLOW}⚠️  pnpm global install failed, trying alternative method...${NC}"
    
    # Method 2: Create symlink
    if [ -w "/usr/local/bin" ] || sudo -n true 2>/dev/null; then
        echo -e "${BLUE}🔗 Creating symlink in /usr/local/bin...${NC}"
        
        # Remove existing symlink if it exists
        sudo rm -f /usr/local/bin/blog-publish 2>/dev/null || true
        
        # Create new symlink
        sudo ln -sf "$TOOLS_DIR/blog-publish.js" /usr/local/bin/blog-publish
        echo -e "${GREEN}✅ Symlink created successfully${NC}"
        INSTALL_METHOD="symlink"
    else
        echo -e "${RED}❌ Cannot create symlink. No sudo access to /usr/local/bin${NC}"
        
        # Method 3: Add to PATH
        echo -e "${BLUE}📝 Adding to PATH via ~/.bashrc...${NC}"
        
        # Check if already in PATH
        if ! grep -q "$TOOLS_DIR" ~/.bashrc 2>/dev/null; then
            echo "# Bedtime Blog Publishing Tool" >> ~/.bashrc
            echo "export PATH=\"$TOOLS_DIR:\$PATH\"" >> ~/.bashrc
            echo -e "${GREEN}✅ Added to PATH in ~/.bashrc${NC}"
            echo -e "${YELLOW}⚠️  Run 'source ~/.bashrc' or restart your terminal${NC}"
        else
            echo -e "${GREEN}✅ Already in PATH${NC}"
        fi
        INSTALL_METHOD="path"
    fi
fi

# Test installation
echo -e "${BLUE}🧪 Testing installation...${NC}"

# Wait a moment for symlink to be available
sleep 1

if command -v blog-publish &> /dev/null; then
    echo -e "${GREEN}✅ Installation test passed!${NC}"
    
    # Show version/help
    echo -e "${BLUE}📋 Tool information:${NC}"
    blog-publish --help | head -5
    
elif [ -x "$TOOLS_DIR/blog-publish.js" ]; then
    echo -e "${YELLOW}⚠️  Global command 'blog-publish' not available${NC}"
    echo -e "${BLUE}💡 You can use: node $TOOLS_DIR/blog-publish.js${NC}"
    
    # Test the direct path
    echo -e "${BLUE}🧪 Testing direct path...${NC}"
    node "$TOOLS_DIR/blog-publish.js" --help | head -5
    echo -e "${GREEN}✅ Direct path works!${NC}"
else
    echo -e "${RED}❌ Installation test failed${NC}"
    exit 1
fi

# Create quick reference
echo -e "${BLUE}📝 Creating quick reference...${NC}"
cat > "$TOOLS_DIR/QUICK_REFERENCE.md" << 'EOF'
# Quick Reference - Blog Publishing Tool

## Global Usage (after installation)
```bash
# Basic publishing
blog-publish ./my-post.md

# Fast content method
blog-publish ./my-post.md --content

# With custom API key
blog-publish ./my-post.md --api-key YOUR_KEY

# Show help
blog-publish --help
```

## Alternative Usage (if global install failed)
```bash
# Direct execution
node /path/to/tools/blog-publish.js ./my-post.md

# From tools directory
cd /path/to/tools && node blog-publish.js ./my-post.md
```

## Required Markdown Format
```markdown
---
title: "Your Post Title"
description: "Post description"
date: 2025-08-04
tags: [tag1, tag2]
---

# Your Content Here
Your blog post content...
```
EOF

echo ""
echo -e "${GREEN}🎉 Installation Complete!${NC}"
echo "================================="

case $INSTALL_METHOD in
    "pnpm")
        echo -e "${GREEN}✅ Installed globally with pnpm${NC}"
        echo -e "${BLUE}📝 Usage: blog-publish ./your-post.md${NC}"
        ;;
    "symlink")
        echo -e "${GREEN}✅ Installed via symlink${NC}"
        echo -e "${BLUE}📝 Usage: blog-publish ./your-post.md${NC}"
        ;;
    "path")
        echo -e "${GREEN}✅ Added to PATH${NC}"
        echo -e "${YELLOW}⚠️  Restart your terminal or run: source ~/.bashrc${NC}"
        echo -e "${BLUE}📝 Usage: blog-publish.js ./your-post.md${NC}"
        ;;
esac

echo ""
echo -e "${BLUE}📖 Documentation: $TOOLS_DIR/BLOG_PUBLISHING_COMPLETE_GUIDE.md${NC}"
echo -e "${BLUE}🔧 Quick Reference: $TOOLS_DIR/QUICK_REFERENCE.md${NC}"
echo ""
echo -e "${GREEN}Happy blogging! 🚀${NC}"
