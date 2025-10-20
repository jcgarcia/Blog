// API configuration for the blog frontend
// This file centralizes all API-related configuration

// Get API base URL from environment variable, fallback to production URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || "https://bapi.ingasti.com";

// Remove trailing slash and ensure consistent API_URL without ending slash
export const API_URL = API_BASE_URL.replace(/\/$/, '');

// Common API endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: `${API_URL}/api/auth/login`,
    GOOGLE: `${API_URL}/api/auth/google`,
    FACEBOOK: `${API_URL}/api/auth/facebook`,
    TWITTER: `${API_URL}/api/auth/twitter`,
    LOGOUT: `${API_URL}/api/auth/logout`,
    VERIFY: `${API_URL}/api/auth/verify`,
    COGNITO_TEST: `${API_URL}/api/auth/cognito/test`,
    COGNITO_LOGIN: `${API_URL}/api/auth/cognito/login`,
  },
  
  // Admin
  ADMIN: {
    LOGIN: `${API_URL}/api/admin/login`,
    VERIFY: `${API_URL}/api/admin/verify`,
    LOGOUT: `${API_URL}/api/admin/logout`,
    USERS: `${API_URL}/api/users`,
    USER: (id) => `${API_URL}/api/users/${id}`,
  },
  
  // Posts
  POSTS: {
    LIST: `${API_URL}/api/posts`,
    CREATE: `${API_URL}/api/posts`,
    GET: (id) => `${API_URL}/api/posts/${id}`,
    UPDATE: (id) => `${API_URL}/api/posts/${id}`,
    DELETE: (id) => `${API_URL}/api/posts/${id}`,
  },
  
  // Users
  USERS: {
    PROFILE: `${API_URL}/api/users/profile`,
    UPDATE: `${API_URL}/api/users/profile`,
  },
  
  // Settings
  SETTINGS: {
    GET: `${API_URL}/api/settings`,
    GET_ADMIN: `${API_URL}/api/settings/admin`,
    UPDATE: `${API_URL}/api/settings`,
    SOCIAL: `${API_URL}/api/settings/social`,
    CONTACT: `${API_URL}/api/settings/contact`,
    SMTP: `${API_URL}/api/settings/smtp`,
    SMTP_TEST: `${API_URL}/api/settings/smtp/test`,
    OAUTH: `${API_URL}/api/settings/oauth`,
    OAUTH_TEST: (provider) => `${API_URL}/api/settings/oauth/test/${provider}`,
    AWS_EXTERNAL_ID: `${API_URL}/api/settings/aws-external-id`,
    AWS_CONFIG: `${API_URL}/api/settings/aws-config`,
    MEDIA_STORAGE: `${API_URL}/api/settings/media-storage`,
  },
  
  // Contact
  CONTACT: `${API_URL}/api/contact`,
  
  // Upload
  UPLOAD: `${API_URL}/api/upload`,
  
  // Publish
  PUBLISH: {
    MARKDOWN: `${API_URL}/api/publish/markdown`,
    CONTENT: `${API_URL}/api/publish/content`,
  },
  
  // Health check
  HEALTH: `${API_URL}/health`,
  
  // Media management
  MEDIA: {
    BASE_URL: API_URL,
    BASE: `${API_URL}/api/media`,
    FILES: `${API_URL}/api/media/files`,
    FOLDERS: `${API_URL}/api/media/folders`,
    UPLOAD: `${API_URL}/api/media/upload`,
    DELETE: (id) => `${API_URL}/api/media/files/${id}`,
    // Trash management
    TRASH: `${API_URL}/api/media/trash`,
    RESTORE: (id) => `${API_URL}/api/media/trash/${id}/restore`,
    EMPTY_TRASH: `${API_URL}/api/media/trash/empty`,
    // AWS/Connection
    TEST_AWS_CONNECTION: `${API_URL}/api/media/test-aws-connection`,
    TEST_OIDC_CONNECTION: `${API_URL}/api/media/test-oidc-connection`,
    SYNC_S3: `${API_URL}/api/media/sync-s3`,
    SYNC_S3_OIDC: `${API_URL}/api/media/sync-s3-oidc`,
    CREDENTIAL_STATUS: `${API_URL}/api/media/credential-status`,
    REFRESH_CREDENTIALS: `${API_URL}/api/media/refresh-credentials`,
    INITIALIZE_SSO: `${API_URL}/api/media/initialize-sso`,
    COMPLETE_SSO: `${API_URL}/api/media/complete-sso`,
  },
  
  // Database management
  DATABASE: {
    INFO: `${API_URL}/api/database/info`,
    // Multi-database management
    HEALTH: `${API_URL}/api/database/health`,
    CONNECTIONS: `${API_URL}/api/database/connections`,
    CREATE_CONNECTION: `${API_URL}/api/database/connections`,
    UPDATE_CONNECTION: (id) => `${API_URL}/api/database/connections/${id}`,
    DELETE_CONNECTION: (id) => `${API_URL}/api/database/connections/${id}`,
    SWITCH: `${API_URL}/api/database/switch`,
    TEST: `${API_URL}/api/database/test`,
    // Backup operations
    BACKUP: `${API_URL}/api/database/backup`,
    BACKUPS: `${API_URL}/api/database/backups`,
    DELETE_BACKUP: (filename) => `${API_URL}/api/database/backups/${filename}`,
    EXPORT_TABLE: (table) => `${API_URL}/api/database/export/${table}`,
    RESTORE: `${API_URL}/api/database/restore`,
  },
};

// Export the base URL for media management
export const BASE_URL = API_URL;

// Helper function to build API URLs
export const buildApiUrl = (endpoint) => {
  return endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
};

// Export for debugging
console.log('API Configuration:', {
  API_BASE_URL,
  API_URL,
  NODE_ENV: import.meta.env.MODE || 'development'
});
