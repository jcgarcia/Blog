#!/bin/bash

# Jenkins CLI Setup Script for Blog Deployment
# This script helps set up Jenkins CLI with proper authentication

echo "🔧 Jenkins CLI Setup for Blog Deployment"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Jenkins CLI is already downloaded
if [ ! -f "$HOME/jenkins-cli.jar" ]; then
    echo -e "${YELLOW}📥 Downloading Jenkins CLI...${NC}"
    
    # Download Jenkins CLI
    if wget -q https://jenkins.ingasti.com/jnlpJars/jenkins-cli.jar -O "$HOME/jenkins-cli.jar"; then
        echo -e "${GREEN}✅ Jenkins CLI downloaded successfully${NC}"
    else
        echo -e "${RED}❌ Failed to download Jenkins CLI${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Jenkins CLI already exists at $HOME/jenkins-cli.jar${NC}"
fi

# Test basic connection
echo ""
echo "🔍 Testing Jenkins connection..."
if java -jar "$HOME/jenkins-cli.jar" -s https://jenkins.ingasti.com/ help > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Jenkins server is accessible${NC}"
else
    echo -e "${RED}❌ Cannot connect to Jenkins server${NC}"
    echo "Please check:"
    echo "  - Jenkins server is running at https://jenkins.ingasti.com/"
    echo "  - Network connectivity"
    echo "  - Java is installed"
    exit 1
fi

# Check authentication status
echo ""
echo "🔐 Checking authentication status..."
AUTH_STATUS=$(java -jar "$HOME/jenkins-cli.jar" -s https://jenkins.ingasti.com/ who-am-i 2>/dev/null)

if echo "$AUTH_STATUS" | grep -q "anonymous"; then
    echo -e "${YELLOW}⚠️  Currently authenticated as: anonymous${NC}"
    echo ""
    echo "To use Jenkins CLI effectively, you need to authenticate."
    echo ""
    echo "📝 Steps to set up authentication:"
    echo "1. Go to Jenkins web interface: https://jenkins.ingasti.com/"
    echo "2. Click on your username (top right)"
    echo "3. Click 'Configure'"
    echo "4. Scroll down to 'API Token'"
    echo "5. Click 'Add new Token'"
    echo "6. Give it a name (e.g., 'cli-access') and click 'Generate'"
    echo "7. Copy the generated token"
    echo ""
    echo "Then run one of these commands:"
    echo ""
    echo "# Test with your credentials:"
    echo "java -jar ~/jenkins-cli.jar -s https://jenkins.ingasti.com/ -auth yourusername:your-api-token who-am-i"
    echo ""
    echo "# Create permanent alias (add to ~/.bashrc or ~/.zshrc):"
    echo "alias jenkins-cli='java -jar ~/jenkins-cli.jar -s https://jenkins.ingasti.com/ -auth yourusername:your-api-token'"
else
    echo -e "${GREEN}✅ Authentication successful${NC}"
    echo "$AUTH_STATUS"
fi

echo ""
echo "📋 Next Steps for Blog Deployment:"
echo "1. Set up authentication (if not already done)"
echo "2. Create blog credentials:"
echo "   - blog-database-url"
echo "   - blog-jwt-secret"
echo "3. Create Blog-Deployment multibranch pipeline job"
echo "4. Trigger deployment pipeline"
echo ""
echo "📚 See detailed instructions in:"
echo "  - JENKINS_ENVIRONMENT_SETUP.md"
echo "  - JENKINS_CLI_GUIDE.md"

echo ""
echo -e "${GREEN}🎉 Jenkins CLI setup completed!${NC}"
