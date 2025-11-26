#!/bin/bash

# Script to generate properly encoded Kubernetes secrets
# This creates the actual blog-secrets.yaml with base64-encoded values

echo "Creating Kubernetes secrets with base64-encoded values..."

# Aiven PostgreSQL Configuration
PGHOST_B64=$(echo -n "ingasti-pg-ingasti.c.aivencloud.com" | base64 -w 0)
PGPORT_B64=$(echo -n "25306" | base64 -w 0)
PGDATABASE_B64=$(echo -n "blog" | base64 -w 0)
PGUSER_B64=$(echo -n "avnadmin" | base64 -w 0)
PGPASSWORD_B64=$(echo -n "${AIVEN_PASSWORD:-YOUR_PASSWORD_HERE}" | base64 -w 0)
PGSSLMODE_B64=$(echo -n "require" | base64 -w 0)

# Application Secrets  
JWT_SECRET_B64=$(echo -n "your-jwt-secret-here" | base64 -w 0)
BLOG_API_KEY_B64=$(echo -n "${BLOG_API_KEY:-YOUR_API_KEY_HERE}" | base64 -w 0)
BLOG_API_URL_B64=$(echo -n "https://bapi.ingasti.com/" | base64 -w 0)
BLOG_USER_ID_B64=$(echo -n "1" | base64 -w 0)

cat > k8s/blog-secrets-real.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: blog-secrets
  namespace: blog
type: Opaque
data:
  # PostgreSQL Database Configuration (Base64 encoded)
  PGHOST: ${PGHOST_B64}
  PGPORT: ${PGPORT_B64}
  PGDATABASE: ${PGDATABASE_B64}
  PGUSER: ${PGUSER_B64}
  PGPASSWORD: ${PGPASSWORD_B64}
  PGSSLMODE: ${PGSSLMODE_B64}
  
  # Application Secrets (Base64 encoded)
  JWT_SECRET: ${JWT_SECRET_B64}
  BLOG_API_KEY: ${BLOG_API_KEY_B64}
  BLOG_API_URL: ${BLOG_API_URL_B64}
  BLOG_USER_ID: ${BLOG_USER_ID_B64}

EOF

echo "✅ Created k8s/blog-secrets-real.yaml with encoded values"
echo ""
echo "To apply these secrets to your cluster:"
echo "  kubectl apply -f k8s/blog-secrets-real.yaml"
echo ""
echo "To update the existing deployment:"
echo "  kubectl rollout restart deployment/blog-backend -n blog"
