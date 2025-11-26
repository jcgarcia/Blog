#!/bin/bash

echo "🔍 Testing Jenkins Webhook Secret Configuration"
echo "============================================="
echo ""

echo "Testing with common webhook secrets..."

WEBHOOK_URL="https://jenkins.ingasti.com/github-webhook/"

# Test payload
PAYLOAD='{"ref":"refs/heads/k8s","repository":{"full_name":"jcgarcia/bedtimeblog"}}'

# Common secrets to test
SECRETS=(
  ""
  "webhook-secret"
  "github-secret"
  "bedtimeblog-webhook"
  "jenkins-webhook"
)

for SECRET in "${SECRETS[@]}"; do
  echo "Testing with secret: '${SECRET}'"
  
  if [ -z "$SECRET" ]; then
    # Test without signature
    RESPONSE=$(curl -s -w "HTTP:%{http_code}" -X POST \
      -H "Content-Type: application/json" \
      -H "X-GitHub-Event: push" \
      -d "$PAYLOAD" \
      "$WEBHOOK_URL" 2>/dev/null)
  else
    # Test with HMAC-SHA256 signature
    SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)
    RESPONSE=$(curl -s -w "HTTP:%{http_code}" -X POST \
      -H "Content-Type: application/json" \
      -H "X-GitHub-Event: push" \
      -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
      -d "$PAYLOAD" \
      "$WEBHOOK_URL" 2>/dev/null)
  fi
  
  HTTP_CODE=$(echo "$RESPONSE" | grep -o "HTTP:[0-9]*" | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | sed 's/HTTP:[0-9]*$//')
  
  case "$HTTP_CODE" in
    "200"|"201")
      echo "✅ SUCCESS with secret: '$SECRET'"
      break
      ;;
    "400")
      if echo "$BODY" | grep -q "Signature"; then
        echo "❌ Wrong or missing signature"
      else
        echo "⚠️  Other 400 error"
      fi
      ;;
    "403")
      echo "❌ Forbidden"
      ;;
    *)
      echo "❓ HTTP $HTTP_CODE"
      ;;
  esac
done

echo ""
echo "📋 Next Steps:"
echo "1. If no secret worked, check Jenkins job configuration"
echo "2. Look for 'GitHub hook trigger for GITScm polling'"
echo "3. Check if secret field is filled or empty"
echo "4. Match the GitHub webhook secret to Jenkins setting"
