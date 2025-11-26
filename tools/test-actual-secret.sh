#!/bin/bash

echo "🧪 Testing Jenkins Webhook with Actual Secret"
echo "============================================"
echo ""

WEBHOOK_URL="https://jenkins.ingasti.com/github-webhook/"
SECRET="5002b8584e6dc478cca3b4591760b4277870bab41aa6eb94fe95268e9a8a850e"

# Create realistic GitHub webhook payload
PAYLOAD=$(cat << 'EOF'
{
  "ref": "refs/heads/k8s",
  "before": "0000000000000000000000000000000000000000",
  "after": "1234567890123456789012345678901234567890",
  "repository": {
    "id": 123456789,
    "name": "bedtimeblog",
    "full_name": "jcgarcia/bedtimeblog",
    "clone_url": "https://github.com/jcgarcia/bedtimeblog.git",
    "html_url": "https://github.com/jcgarcia/bedtimeblog",
    "git_url": "git://github.com/jcgarcia/bedtimeblog.git",
    "ssh_url": "git@github.com:jcgarcia/bedtimeblog.git"
  },
  "pusher": {
    "name": "jcgarcia",
    "email": "jc@example.com"
  },
  "sender": {
    "login": "jcgarcia",
    "id": 12345,
    "type": "User"
  },
  "commits": [
    {
      "id": "1234567890123456789012345678901234567890",
      "tree_id": "abcdef1234567890123456789012345678901234",
      "message": "Test webhook trigger",
      "timestamp": "2025-08-06T14:30:00Z",
      "url": "https://github.com/jcgarcia/bedtimeblog/commit/1234567890123456789012345678901234567890",
      "author": {
        "name": "jcgarcia",
        "email": "jc@example.com",
        "username": "jcgarcia"
      },
      "committer": {
        "name": "jcgarcia",
        "email": "jc@example.com",
        "username": "jcgarcia"
      },
      "added": [],
      "removed": [],
      "modified": ["README.md"]
    }
  ],
  "head_commit": {
    "id": "1234567890123456789012345678901234567890",
    "tree_id": "abcdef1234567890123456789012345678901234",
    "message": "Test webhook trigger",
    "timestamp": "2025-08-06T14:30:00Z",
    "url": "https://github.com/jcgarcia/bedtimeblog/commit/1234567890123456789012345678901234567890",
    "author": {
      "name": "jcgarcia",
      "email": "jc@example.com",
      "username": "jcgarcia"
    },
    "committer": {
      "name": "jcgarcia",
      "email": "jc@example.com",
      "username": "jcgarcia"
    },
    "added": [],
    "removed": [],
    "modified": ["README.md"]
  }
}
EOF
)

echo "📤 Testing webhook with HMAC-SHA256 signature..."

# Generate HMAC-SHA256 signature like GitHub does
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

echo "Generated signature: sha256=$SIGNATURE"
echo ""

# Test with proper GitHub headers
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-GitHub-Delivery: $(uuidgen 2>/dev/null || echo 'test-delivery-123')" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -H "User-Agent: GitHub-Hookshot/abc123" \
  -d "$PAYLOAD" \
  "$WEBHOOK_URL" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")

echo "Response Code: $HTTP_CODE"
echo "Response Body:"
echo "$BODY"
echo ""

case "$HTTP_CODE" in
  "200"|"201")
    echo "✅ SUCCESS! Webhook is working with the secret!"
    echo "   GitHub webhook should now trigger Jenkins builds"
    ;;
  "400")
    if echo "$BODY" | grep -q -i "signature"; then
      echo "❌ Signature verification failed"
      echo "   • Check if Jenkins secret matches GitHub secret"
      echo "   • Verify Jenkins webhook plugin configuration"
    else
      echo "⚠️  Bad Request - Other issue:"
      echo "$BODY" | head -3
    fi
    ;;
  "403")
    echo "❌ Forbidden - Possible causes:"
    echo "   • CSRF protection blocking request"
    echo "   • Jenkins authentication required"
    echo "   • Webhook plugin not properly configured"
    ;;
  "404")
    echo "❌ Webhook endpoint not found"
    ;;
  "405")
    echo "⚠️  Method not allowed - Jenkins might need POST method enabled"
    ;;
  *)
    echo "❓ Unexpected response: $HTTP_CODE"
    echo "   Response: $BODY"
    ;;
esac

echo ""
echo "🔍 Next Steps Based on Result:"
echo "=============================="

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✅ Webhook test successful! Try pushing to your repo to trigger a build."
elif echo "$BODY" | grep -q -i "signature"; then
  echo "🔧 Signature issue detected. Possible fixes:"
  echo "   1. Check Jenkins global configuration for webhook settings"
  echo "   2. Verify the secret credential is properly referenced"
  echo "   3. Check Jenkins logs for detailed error messages"
else
  echo "🔧 Non-signature issue. Recommended actions:"
  echo "   1. Check Jenkins system logs"
  echo "   2. Verify webhook plugin is installed and enabled"
  echo "   3. Check CSRF protection settings"
fi

echo ""
echo "📋 To check Jenkins logs:"
echo "   https://jenkins.ingasti.com/log/all"
