#!/bin/bash

echo "🔧 GitHub Webhook to Jenkins Fix Guide"
echo "====================================="
echo ""

echo "📋 STEP 1: Check Jenkins Job Configuration"
echo "----------------------------------------"
echo "1. Go to: https://jenkins.ingasti.com/job/[YOUR-JOB-NAME]/configure"
echo "2. Scroll to 'Build Triggers' section"
echo "3. Make sure 'GitHub hook trigger for GITScm polling' is CHECKED ✅"
echo "4. If there's a 'Secret' field, note if it's filled or empty"
echo ""

echo "📋 STEP 2: Check Jenkins Global Security"
echo "---------------------------------------"
echo "1. Go to: https://jenkins.ingasti.com/manage/configureSecurity/"
echo "2. Find 'CSRF Protection' section"
echo "3. Make sure 'Enable proxy compatibility' is CHECKED ✅"
echo "4. Look for any webhook-related settings"
echo ""

echo "📋 STEP 3: Fix GitHub Webhook Configuration"
echo "------------------------------------------"
echo "Current webhook URL: https://jenkins.ingasti.com/github-webhook/"
echo ""
echo "GitHub Settings to verify:"
echo "• Payload URL: https://jenkins.ingasti.com/github-webhook/"
echo "• Content type: application/json"
echo "• Events: Just the push event (or Send me everything)"
echo "• Active: ✅ Checked"
echo "• Secret: Should match Jenkins job secret (if any)"
echo ""

echo "🧪 STEP 4: Test Webhook Manually"
echo "-------------------------------"

# Create test payload
cat > /tmp/webhook_test.json << 'EOF'
{
  "ref": "refs/heads/k8s",
  "before": "0000000000000000000000000000000000000000",
  "after": "1234567890123456789012345678901234567890",
  "repository": {
    "id": 123456,
    "name": "bedtimeblog",
    "full_name": "jcgarcia/bedtimeblog",
    "clone_url": "https://github.com/jcgarcia/bedtimeblog.git",
    "html_url": "https://github.com/jcgarcia/bedtimeblog"
  },
  "pusher": {
    "name": "jcgarcia",
    "email": "jc@example.com"
  },
  "commits": [
    {
      "id": "1234567890123456789012345678901234567890",
      "message": "Test webhook",
      "url": "https://github.com/jcgarcia/bedtimeblog/commit/1234567890123456789012345678901234567890",
      "author": {
        "name": "jcgarcia",
        "email": "jc@example.com"
      }
    }
  ]
}
EOF

echo "Testing webhook without secret..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: $(uuidgen)" \
  -H "User-Agent: GitHub-Hookshot/abc123" \
  -d @/tmp/webhook_test.json \
  https://jenkins.ingasti.com/github-webhook/ 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

echo "Response Code: $HTTP_CODE"
echo "Response Body: $BODY"

# Cleanup
rm -f /tmp/webhook_test.json

echo ""
echo "🔍 Response Analysis:"
case "$HTTP_CODE" in
  "200"|"201")
    echo "✅ SUCCESS! Webhook is working correctly"
    ;;
  "400")
    echo "⚠️  Bad Request - Check webhook payload format or secret"
    ;;
  "403")
    echo "❌ Forbidden - Most likely causes:"
    echo "   • Jenkins job not configured for GitHub webhooks"
    echo "   • CSRF protection blocking request"
    echo "   • Authentication required"
    ;;
  "404")
    echo "❌ Not Found - Webhook endpoint doesn't exist"
    ;;
  "405")
    echo "⚠️  Method Not Allowed - Endpoint exists but POST might not be configured"
    ;;
  *)
    echo "❓ Unexpected response code: $HTTP_CODE"
    ;;
esac

echo ""
echo "🛠️  QUICK FIXES:"
echo "==============="
echo ""
echo "FIX 1: Enable GitHub Webhook in Jenkins Job"
echo "-------------------------------------------"
echo "1. Jenkins → Your Job → Configure"
echo "2. Build Triggers → ✅ 'GitHub hook trigger for GITScm polling'"
echo "3. Save"
echo ""
echo "FIX 2: Update GitHub Webhook Settings"
echo "------------------------------------"
echo "1. GitHub → Repo → Settings → Webhooks"
echo "2. Click your webhook"
echo "3. Set these exact settings:"
echo "   • URL: https://jenkins.ingasti.com/github-webhook/"
echo "   • Content type: application/json"
echo "   • Secret: (leave empty or match Jenkins)"
echo "   • Events: Just the push event"
echo "   • Active: ✅"
echo "4. Update webhook"
echo ""
echo "FIX 3: Disable CSRF for Webhooks (if needed)"
echo "-------------------------------------------"
echo "1. Jenkins → Manage Jenkins → Configure Global Security"
echo "2. CSRF Protection → ✅ 'Enable proxy compatibility'"
echo "3. Save"
echo ""
echo "After applying fixes, test by pushing to your repository!"
