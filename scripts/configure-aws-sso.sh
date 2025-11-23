#!/bin/bash

# Script to configure AWS SSO auto-refresh for Bedtime Blog
echo "🔧 Configuring AWS SSO auto-refresh system..."

# Create the AWS configuration with SSO parameters
cat > /tmp/aws_sso_config.json << 'EOF'
{
  "ssoStartUrl": "https://ingasti.awsapps.com/start/#",
  "ssoRegion": "eu-west-2",
  "ssoAccountId": "007041844937",
  "ssoRoleName": "BlogMediaLibraryAccess",
  "accountId": "007041844937",
  "roleName": "BlogMediaLibraryAccess",
  "region": "eu-west-2",
  "bucketName": "bedtimeblog-medialibrary",
  "autoRefreshEnabled": true,
  "credentialSource": "aws-sso-auto-refresh",
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "configuredBy": "SSO-auto-refresh-migration"
}
EOF

echo "📋 AWS SSO Configuration:"
cat /tmp/aws_sso_config.json | jq .

echo ""
echo "🔄 This configuration will:"
echo "  ✅ Enable AWS SSO auto-refresh"
echo "  ✅ Remove dependency on Identity Center portal credentials"
echo "  ✅ Use SDK temporary credentials that refresh automatically"
echo "  ❌ Remove manual Access Key/Secret Key credentials"

echo ""
echo "⚠️  Before applying this configuration:"
echo "  1. Ensure 'aws sso login' has been run on the server"
echo "  2. Ensure the SSO role 'BlogMediaLibraryAccess' has proper S3 permissions"
echo "  3. Test the configuration before applying to production"

echo ""
echo "🚀 To apply this configuration:"
echo "  1. Call: curl -X PUT https://bapi.ingasti.com/api/settings/aws-config \\"
echo "           -H 'Content-Type: application/json' \\"  
echo "           -H 'Authorization: Bearer [ADMIN_TOKEN]' \\"
echo "           -d @/tmp/aws_sso_config.json"
echo ""
echo "  2. Or update via Operations Panel > Media > AWS SSO Configuration"
echo ""
echo "📊 After configuration, check status:"
echo "     curl https://bapi.ingasti.com/api/aws/credential-status"

# Clean up
rm -f /tmp/aws_sso_config.json

echo ""
echo "✅ SSO configuration prepared. Ready to apply!"