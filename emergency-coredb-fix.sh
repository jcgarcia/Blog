#!/bin/bash

# Emergency CoreDB Fix Script - Use after Jenkins build #765 deploys
# Fixes the encryption key mismatch causing "bad decrypt" errors

echo "🚨 EMERGENCY CoreDB Encryption Fix"
echo "=================================="

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "❌ jq is required but not installed"
    echo "Install with: sudo apt-get install jq"
    exit 1
fi

# Get admin token
echo "🔐 Getting admin token..."
ADMIN_TOKEN=$(curl -s -X POST https://bapi.ingasti.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"coreadmin","password":"CoreAdmin2025#Secure"}' | \
  jq -r '.token')

if [ "$ADMIN_TOKEN" = "null" ] || [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ Failed to get admin token"
    echo "Check admin credentials and try again"
    exit 1
fi

echo "✅ Admin token obtained"

# Check CoreDB status first
echo ""
echo "🔍 Checking CoreDB status..."
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://bapi.ingasti.com/api/emergency/coredb-status | jq '.'

echo ""
echo "🧹 Clearing corrupted encrypted connections..."

# Clear corrupted connections
RESULT=$(curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://bapi.ingasti.com/api/emergency/clear-corrupted-connections)

echo "$RESULT" | jq '.'

if echo "$RESULT" | jq -r '.success' | grep -q true; then
    echo ""
    echo "✅ SUCCESS: Corrupted connections cleared!"
    echo ""
    echo "🎯 NEXT STEPS:"
    echo "1. Go to https://bedtime.ingasti.com/ops"
    echo "2. Click 'Add New Connection'"
    echo "3. Use these settings:"
    echo "   - Name: Blog PostgreSQL Container"
    echo "   - Host: blog-postgres-service"  
    echo "   - Port: 5432"
    echo "   - Database: blog"
    echo "   - Username: dbcore_usr_2025"
    echo "   - Password: DbSecure2025#XpL3vN7wE5xT6gH4uY1zC0"
    echo "   - SSL: true"
    echo "4. Click 'Test Connection' then 'Create'"
    echo "5. The connection should now persist properly!"
    echo ""
    echo "🔧 The encryption key issue has been resolved."
else
    echo ""
    echo "❌ FAILED: Could not clear corrupted connections"
    echo "Check the API response above for details"
fi