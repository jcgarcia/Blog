#!/bin/bash

# Test AWS SSO credential extraction
echo "🔍 Testing AWS SSO credential extraction for Blog..."

# Blog AWS configuration
ACCOUNT_ID="007041844937"
ROLE_NAME="BlogMediaLibraryAccess" 
REGION="eu-west-2"

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed"
    exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "❌ jq is not installed"
    exit 1
fi

# Find SSO cache file
CACHE_FILE=$(find ~/.aws/sso/cache -type f -exec grep -l "startUrl" {} + 2>/dev/null | head -1)

if [[ -z "$CACHE_FILE" ]]; then
    echo "❌ No SSO cache file found"
    echo "💡 Run 'aws sso login --profile <your-profile>' first"
    exit 1
fi

echo "📁 Found SSO cache: $CACHE_FILE"

# Extract access token
ACCESS_TOKEN=$(jq -r '.accessToken' "$CACHE_FILE" 2>/dev/null)

if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
    echo "❌ No valid access token found"
    echo "💡 Run 'aws sso login' to refresh your session"
    exit 1
fi

echo "✅ Access token found: ${ACCESS_TOKEN:0:20}..."

# List available accounts and roles
echo "🔍 Available AWS accounts and roles:"
aws sso list-accounts --access-token "$ACCESS_TOKEN" --output table 2>/dev/null || {
    echo "❌ Failed to list accounts. Token may be expired."
    exit 1
}

echo ""
echo "✅ AWS SSO setup is working correctly!"
echo "💡 You can now configure the blog script with your specific:"
echo "   - Account ID"
echo "   - Role Name" 
echo "   - Region"