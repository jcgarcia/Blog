#!/bin/bash

echo "🔍 Checking Jenkins job configuration for webhook secrets..."

# Common webhook secrets to try (you'll need to provide the actual one)
SECRETS=("webhook-secret" "github-secret" "blog-webhook" "")

JENKINS_URL="https://jenkins.ingasti.com/github-webhook/"

# Create payload
PAYLOAD='{"ref":"refs/heads/k8s","repository":{"full_name":"jcgarcia/bedtimeblog"}}'

echo "Testing without signature (current GitHub setup)..."
curl -s -w "HTTP: %{http_code}\n" -X POST \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d "$PAYLOAD" \
  "$JENKINS_URL" | head -5

echo ""
echo "To fix this, you need to either:"
echo "1. Add a webhook secret in GitHub that matches Jenkins, OR"
echo "2. Remove webhook secret requirement from Jenkins job"
echo ""
echo "📋 To check your Jenkins job:"
echo "1. Go to Jenkins → [Your Job] → Configure"
echo "2. Look for 'GitHub hook trigger for GITScm polling'"
echo "3. Check if 'Secret' field is filled"
echo ""
echo "📋 To configure GitHub webhook secret:"
echo "1. GitHub → Repo → Settings → Webhooks → [Your webhook]"
echo "2. Add secret in 'Secret' field"
echo "3. Make sure it matches Jenkins job secret"
