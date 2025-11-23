#!/bin/bash

echo "🔐 Google OAuth Setup Helper"
echo "============================="
echo ""
echo "📋 Steps to set up Google OAuth:"
echo ""
echo "1. Go to Google Cloud Console: https://console.cloud.google.com/"
echo "2. Create a new project or select existing one"
echo "3. Enable Google+ API"
echo "4. Go to 'Credentials' → 'Create Credentials' → 'OAuth 2.0 Client IDs'"
echo "5. Set application type to 'Web application'"
echo "6. Add authorized redirect URIs:"
echo "   - https://bapi.ingasti.com/api/auth/google/callback"
echo "   - http://localhost:5001/api/auth/google/callback (for local testing)"
echo ""
echo "🔑 After creating OAuth credentials, enter them below:"
echo ""

read -p "Enter Google Client ID: " CLIENT_ID
read -s -p "Enter Google Client Secret: " CLIENT_SECRET
echo ""

if [ -n "$CLIENT_ID" ] && [ -n "$CLIENT_SECRET" ]; then
    echo ""
    echo "📝 Base64 encoded values for Kubernetes secrets:"
    echo "================================================="
    echo ""
    echo "GOOGLE_CLIENT_ID: $(echo -n "$CLIENT_ID" | base64 -w 0)"
    echo "GOOGLE_CLIENT_SECRET: $(echo -n "$CLIENT_SECRET" | base64 -w 0)"
    echo ""
    echo "🔧 To update the secrets:"
    echo "1. Replace the placeholder values in k8s/blog-secrets.yaml"
    echo "2. Run: kubectl apply -f k8s/blog-secrets.yaml"
    echo "3. Restart the backend deployment: kubectl rollout restart deployment/blog-backend -n blog"
    echo ""
else
    echo "❌ Error: Please provide both Client ID and Client Secret"
fi
