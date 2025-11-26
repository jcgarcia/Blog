#!/bin/bash

# GitHub Webhook Test Script
# This simulates a GitHub push webhook to test Jenkins connectivity

echo "🔍 Testing GitHub Webhook to Jenkins..."
echo "===================================="

JENKINS_URL="https://jenkins.ingasti.com/github-webhook/"
REPO_URL="https://github.com/jcgarcia/bedtimeblog"

# Create a sample webhook payload
cat > webhook_payload.json << EOF
{
  "ref": "refs/heads/k8s",
  "repository": {
    "full_name": "jcgarcia/bedtimeblog",
    "clone_url": "${REPO_URL}.git",
    "html_url": "${REPO_URL}"
  },
  "pusher": {
    "name": "jcgarcia"
  },
  "commits": [
    {
      "id": "test-webhook-$(date +%s)",
      "message": "Test webhook trigger",
      "url": "${REPO_URL}/commit/test"
    }
  ]
}
EOF

echo "📤 Sending test webhook to Jenkins..."
RESPONSE=$(curl -s -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d @webhook_payload.json \
  "${JENKINS_URL}")

HTTP_CODE="${RESPONSE: -3}"
RESPONSE_BODY="${RESPONSE%???}"

echo "Response Code: ${HTTP_CODE}"
echo "Response Body: ${RESPONSE_BODY}"

if [ "${HTTP_CODE}" = "200" ]; then
    echo "✅ Webhook test successful!"
elif [ "${HTTP_CODE}" = "405" ]; then
    echo "⚠️  Method not allowed - check if GitHub webhook trigger is enabled in Jenkins job"
elif [ "${HTTP_CODE}" = "404" ]; then
    echo "❌ Webhook endpoint not found - check Jenkins URL"
elif [ "${HTTP_CODE}" = "403" ]; then
    echo "❌ Forbidden - check Jenkins authentication/permissions"
else
    echo "❌ Webhook test failed with code ${HTTP_CODE}"
fi

# Cleanup
rm -f webhook_payload.json

echo ""
echo "🔍 Next steps to check:"
echo "1. GitHub repo → Settings → Webhooks → Recent Deliveries"
echo "2. Jenkins job → Build History for new builds"
echo "3. Jenkins → Manage Jenkins → System Log for webhook activity"
