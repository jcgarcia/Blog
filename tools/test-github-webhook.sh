#!/bin/bash

# GitHub Webhook Troubleshooting Script
# This script tests the Jenkins webhook endpoint with different configurations

echo "🔍 GitHub Webhook Troubleshooting"
echo "================================="

JENKINS_URL="https://jenkins.ingasti.com"
WEBHOOK_ENDPOINT="${JENKINS_URL}/github-webhook/"

# Test 1: Basic connectivity
echo "Test 1: Basic connectivity check..."
curl -I "$WEBHOOK_ENDPOINT" 2>/dev/null | head -1
echo ""

# Test 2: POST without authentication
echo "Test 2: POST request without authentication..."
curl -X POST \
  -H "Content-Type: application/json" \
  -H "User-Agent: GitHub-Hookshot/abc123" \
  -d '{"zen":"Keep it logically awesome.","hook_id":123}' \
  "$WEBHOOK_ENDPOINT" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s -o /tmp/webhook_response.txt

echo "Response body:"
cat /tmp/webhook_response.txt
echo -e "\n"

# Test 3: Check if Jenkins requires crumb
echo "Test 3: Checking if Jenkins requires CSRF crumb..."
CRUMB=$(curl -s "${JENKINS_URL}/crumbIssuer/api/json" | grep -o '"crumb":"[^"]*"' | cut -d'"' -f4 2>/dev/null)
if [ -n "$CRUMB" ]; then
    echo "CSRF crumb found: $CRUMB"
    
    echo "Test 3a: POST with CSRF crumb..."
    curl -X POST \
      -H "Content-Type: application/json" \
      -H "User-Agent: GitHub-Hookshot/abc123" \
      -H "Jenkins-Crumb: $CRUMB" \
      -d '{"zen":"Keep it logically awesome.","hook_id":123}' \
      "$WEBHOOK_ENDPOINT" \
      -w "\nHTTP Status: %{http_code}\n" \
      -s -o /tmp/webhook_response_crumb.txt
    
    echo "Response with crumb:"
    cat /tmp/webhook_response_crumb.txt
    echo -e "\n"
else
    echo "No CSRF crumb required or accessible anonymously"
fi

# Test 4: Check Jenkins webhook endpoint documentation
echo "Test 4: Checking Jenkins webhook endpoint..."
curl -s "${JENKINS_URL}/plugin/ghprb/" 2>/dev/null | grep -q "GitHub" && echo "GitHub Pull Request Builder plugin detected" || echo "Standard GitHub integration"

echo ""
echo "🔧 Recommendations based on 403 errors:"
echo "1. Check Jenkins → Manage → Configure Global Security"
echo "2. Ensure 'Enable proxy compatibility' is checked"
echo "3. Consider adding webhook secret to GitHub"
echo "4. Check if anonymous users have webhook permissions"

# Cleanup
rm -f /tmp/webhook_response.txt /tmp/webhook_response_crumb.txt
