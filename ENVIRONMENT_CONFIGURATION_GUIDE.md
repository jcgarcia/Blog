# Environment Configuration Guide - CoreDB-Centric Architecture

## Overview

The Bedtime Blog has been migrated to a **CoreDB-centric architecture** where configuration values are managed dynamically through the database instead of hardcoded in environment files.

## What Changed

### Before (Hardcoded Approach)
- OAuth settings hardcoded in `.env` files
- CORS origins hardcoded in code
- Configuration required code changes and redeployments
- Multiple places to maintain the same values

### After (CoreDB-Centric Approach)
- Configuration stored in CoreDB `system_config` table
- Frontend fetches config from `/api/settings` endpoint
- Backend loads config dynamically from CoreDB
- Changes through ops panel without code deployments

## Configuration Sources

### 1. CoreDB (Primary Source)
Configuration managed through CoreDB `system_config` table:

```sql
-- OAuth Configuration
oauth.cognito_client_id     = "50bvr2ect5ja74rc3qtdb3jn1a"
oauth.cognito_domain        = "blog-auth-1756980364.auth.eu-west-2.amazoncognito.com"
oauth.frontend_url          = "https://bedtime.ingasti.com"
oauth.google_client_id      = ""
oauth.google_client_secret  = ""

-- API Configuration  
api.cors_origins            = ["https://bedtime.ingasti.com", "http://localhost:3000"]
api.url                     = "https://bapi.ingasti.com"

-- Meta Configuration
meta.base_url               = "https://bedtime.ingasti.com"
social.crawler_base_url     = "https://bedtime.ingasti.com"
```

### 2. Environment Variables (Fallback)
Environment variables are still used as fallback when CoreDB is unavailable:

```bash
# Still supported for backward compatibility
GOOGLE_CLIENT_ID=fallback-client-id
GOOGLE_CLIENT_SECRET=fallback-client-secret
CORS_ORIGIN=https://fallback-domain.com
```

### 3. Kubernetes Secrets (Jenkins Injection)
Sensitive values are still injected by Jenkins through K8s secrets:

```yaml
# These are injected by Jenkins deployment pipeline
GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
JWT_SECRET: ${JWT_SECRET}
SESSION_SECRET: ${SESSION_SECRET}
```

## Configuration Management

### Frontend Configuration
Frontend components automatically fetch configuration from API:

```javascript
// Login.jsx and CognitoLogin.jsx
const response = await fetch(`${apiUrl}/api/settings`);
const settings = await response.json();

const cognitoConfig = {
  domain: settings['oauth.cognito_domain'],
  clientId: settings['oauth.cognito_client_id'],
  redirectUri: settings['oauth.frontend_url'] + '/auth/callback'
};
```

### Backend Configuration
Backend loads configuration from CoreDB with fallbacks:

```javascript
// API index.js and middleware
const coreDB = CoreDB.getInstance();
const corsOrigins = await coreDB.getConfig('api.cors_origins');
const googleClientId = await coreDB.getConfig('oauth.google_client_id');
```

## Ops Panel Management

Access the ops panel at `/ops` to manage configuration:

1. **OAuth Settings**: Configure Cognito and Google OAuth
2. **API Settings**: Manage CORS origins and API URLs
3. **Meta Settings**: Configure base URLs for social sharing
4. **Database Config**: Manage database connections

## Environment File Status

### Updated Files (Phase 5)
- ✅ `client/.env.production` - Removed hardcoded Cognito values
- ✅ `client/.env.local` - Removed hardcoded Cognito values  
- ✅ `.env.production` - Updated OAuth comments
- ✅ `api/.env.template` - Updated with CoreDB notes

### Backup Location
All original environment files backed up to:
```
../activity/backups/env-files-pre-phase5-20251105-103345/
```

## Benefits

### 1. Dynamic Configuration
- Change configuration without code deployments
- Immediate effect across all instances
- A/B testing capabilities

### 2. Centralized Management
- Single source of truth in CoreDB
- Consistent configuration across environments
- Easy rollback capabilities

### 3. Security
- Sensitive values remain in Kubernetes secrets
- Public values accessible via API
- Proper separation of concerns

### 4. Developer Experience
- No more environment file management
- Configuration through web interface
- Real-time configuration updates

## Migration Summary

**Phases Completed:**
- ✅ Phase 1: Meta Generator CoreDB Integration
- ✅ Phase 2: Social Crawler CoreDB Integration  
- ✅ Phase 3: API Index.js CoreDB Integration
- ✅ Phase 4: Frontend Components CoreDB Integration
- ✅ Phase 5: Environment Files Cleanup

**Hardcoded Values Eliminated:**
- Meta generator baseURL → `meta.base_url` (CoreDB)
- Social crawler baseURL → `social.crawler_base_url` (CoreDB)
- CORS origins → `api.cors_origins` (CoreDB)
- Google OAuth config → `oauth.google_*` (CoreDB)
- Cognito OAuth config → `oauth.cognito_*` (CoreDB)

The blog is now fully **CoreDB-centric** with dynamic configuration management! 🎉