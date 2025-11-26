#!/usr/bin/env node

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

function updateProductionConfig() {
  console.log(`${colors.blue}🔧 Updating Production Configuration for PostgreSQL${colors.reset}`);
  console.log('=====================================================');
  
  // Read the current local configuration
  const localEnvPath = join(__dirname, '..', '.env.local');
  const productionEnvPath = join(__dirname, '..', '.env.production');
  
  if (!fs.existsSync(localEnvPath)) {
    console.error(`${colors.red}❌ Local environment file not found: ${localEnvPath}${colors.reset}`);
    process.exit(1);
  }
  
  console.log(`${colors.yellow}📖 Reading local configuration...${colors.reset}`);
  const localEnv = fs.readFileSync(localEnvPath, 'utf8');
  
  // Extract PostgreSQL configuration from local env
  const pgConfig = {};
  localEnv.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && key.startsWith('PG') && value) {
      pgConfig[key] = value;
    }
  });
  
  console.log(`${colors.green}✅ Found PostgreSQL configuration:${colors.reset}`);
  Object.keys(pgConfig).forEach(key => {
    const displayValue = key === 'PGPASSWORD' ? '***HIDDEN***' : pgConfig[key];
    console.log(`   ${key}=${displayValue}`);
  });
  
  // Create production environment configuration
  const productionConfig = `# Production Environment Variables for Bedtime Blog
# Updated: ${new Date().toISOString()}
# Database: PostgreSQL (Aiven Cloud)

# PostgreSQL Database Configuration (Aiven)
PGHOST=${pgConfig.PGHOST}
PGPORT=${pgConfig.PGPORT}
PGDATABASE=${pgConfig.PGDATABASE}
PGUSER=${pgConfig.PGUSER}
PGPASSWORD=${pgConfig.PGPASSWORD}
PGSSLMODE=${pgConfig.PGSSLMODE || 'require'}

# Alternative DATABASE_URL format (for compatibility)
DATABASE_URL=postgresql://${pgConfig.PGUSER}:${pgConfig.PGPASSWORD}@${pgConfig.PGHOST}:${pgConfig.PGPORT}/${pgConfig.PGDATABASE}?sslmode=${pgConfig.PGSSLMODE || 'require'}

# Authentication
JWT_SECRET=bedtime-blog-jwt-production-secret-2025-very-long-and-secure

# CORS Configuration
CORS_ORIGIN=https://bedtime.ingasti.com

# API Configuration
PORT=5000
NODE_ENV=production

# Frontend Configuration
VITE_API_URL=https://bapi.ingasti.com

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Blog API Configuration (from local)
BLOG_API_KEY=${pgConfig.BLOG_API_KEY || 'your-blog-api-key'}
BLOG_API_URL=https://bapi.ingasti.com/
BLOG_USER_ID=1

# Kubernetes Configuration
KUBERNETES_NAMESPACE=blog
REGISTRY_URL=localhost:5000

# Domain Configuration
FRONTEND_DOMAIN=bedtime.ingasti.com
BACKEND_DOMAIN=bapi.ingasti.com

# Security Configuration
BCRYPT_ROUNDS=12
SESSION_SECRET=another-very-secure-session-secret-for-production

# Upload Configuration
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,mp4,mov,avi

# Monitoring and Logging
LOG_LEVEL=info
ENABLE_PERFORMANCE_MONITORING=true

# Health Check Configuration
HEALTH_CHECK_INTERVAL=30
HEALTH_CHECK_TIMEOUT=5
HEALTH_CHECK_RETRIES=3

# SSL/TLS Configuration
SSL_ENABLED=true
CERT_MANAGER_ISSUER=letsencrypt-prod

# Performance Configuration
MAX_CONNECTIONS=10
CONNECTION_TIMEOUT=30000
REQUEST_TIMEOUT=30000
IDLE_TIMEOUT=10000

# Note: 
# - This configuration uses PostgreSQL instead of MySQL
# - Aiven PostgreSQL cloud database is configured
# - SSL is required for Aiven connections
# - All secrets should be managed securely in production
`;

  // Write the updated production configuration
  fs.writeFileSync(productionEnvPath, productionConfig);
  console.log(`${colors.green}✅ Production configuration updated: ${productionEnvPath}${colors.reset}`);
  
  // Create a Kubernetes ConfigMap YAML
  const k8sConfigPath = join(__dirname, '..', 'k8s-production-config.yaml');
  const k8sConfig = `# Kubernetes ConfigMap for Production Environment
# Apply with: kubectl apply -f k8s-production-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: bedtime-blog-config
  namespace: default
data:
  PGHOST: "${pgConfig.PGHOST}"
  PGPORT: "${pgConfig.PGPORT}"
  PGDATABASE: "${pgConfig.PGDATABASE}"
  PGUSER: "${pgConfig.PGUSER}"
  PGSSLMODE: "${pgConfig.PGSSLMODE || 'require'}"
  PORT: "5000"
  NODE_ENV: "production"
  CORS_ORIGIN: "https://bedtime.ingasti.com"
  VITE_API_URL: "https://bapi.ingasti.com"
  FRONTEND_DOMAIN: "bedtime.ingasti.com"
  BACKEND_DOMAIN: "bapi.ingasti.com"
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "10"
---
# Kubernetes Secret for sensitive data
# Apply with: kubectl apply -f k8s-production-config.yaml
apiVersion: v1
kind: Secret
metadata:
  name: bedtime-blog-secrets
  namespace: default
type: Opaque
stringData:
  PGPASSWORD: "${pgConfig.PGPASSWORD}"
  JWT_SECRET: "bedtime-blog-jwt-production-secret-2025-very-long-and-secure"
  SESSION_SECRET: "another-very-secure-session-secret-for-production"
  BLOG_API_KEY: "${pgConfig.BLOG_API_KEY || 'your-blog-api-key'}"
`;

  fs.writeFileSync(k8sConfigPath, k8sConfig);
  console.log(`${colors.green}✅ Kubernetes configuration created: ${k8sConfigPath}${colors.reset}`);
  
  // Create deployment commands script
  const deployScriptPath = join(__dirname, '..', 'deploy-production-db-fix.sh');
  const deployScript = `#!/bin/bash
# Production Database Configuration Deployment Script
# Run this script to update the production environment

echo "🚀 Deploying PostgreSQL configuration to production..."

# Apply Kubernetes configuration
echo "📝 Applying Kubernetes ConfigMap and Secrets..."
kubectl apply -f k8s-production-config.yaml

# Restart the API deployment to pick up new environment variables
echo "🔄 Restarting API deployment..."
kubectl rollout restart deployment/bedtime-blog-api

# Wait for rollout to complete
echo "⏳ Waiting for deployment to complete..."
kubectl rollout status deployment/bedtime-blog-api --timeout=300s

# Check the status
echo "🔍 Checking deployment status..."
kubectl get pods -l app=bedtime-blog-api

echo "✅ Deployment complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Test the API health: curl https://bapi.ingasti.com/health"
echo "2. Test database health: curl https://bapi.ingasti.com/health/db"
echo "3. Test social links: curl https://bapi.ingasti.com/api/settings/social"
echo "4. Check the blog frontend: https://bedtime.ingasti.com"
echo ""
echo "📊 Monitor logs with:"
echo "kubectl logs -f deployment/bedtime-blog-api"
`;

  fs.writeFileSync(deployScriptPath, deployScript);
  fs.chmodSync(deployScriptPath, '755');
  console.log(`${colors.green}✅ Deployment script created: ${deployScriptPath}${colors.reset}`);
  
  console.log('');
  console.log(`${colors.bright}🎯 Summary of Changes:${colors.reset}`);
  console.log(`${colors.green}✅${colors.reset} Updated .env.production with PostgreSQL configuration`);
  console.log(`${colors.green}✅${colors.reset} Created Kubernetes ConfigMap/Secret YAML`);
  console.log(`${colors.green}✅${colors.reset} Created deployment script`);
  console.log('');
  console.log(`${colors.yellow}⚠️  Manual Steps Required:${colors.reset}`);
  console.log('1. Review the generated files for any sensitive information');
  console.log('2. Update any placeholder values (Google OAuth, etc.)');
  console.log('3. Run the deployment script: ./deploy-production-db-fix.sh');
  console.log('4. Test the endpoints after deployment');
  console.log('');
  console.log(`${colors.blue}📋 Files Created/Updated:${colors.reset}`);
  console.log(`   - ${productionEnvPath}`);
  console.log(`   - ${k8sConfigPath}`);
  console.log(`   - ${deployScriptPath}`);
}

updateProductionConfig();