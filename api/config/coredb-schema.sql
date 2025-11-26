-- CoreDB Initial Schema
-- Created: October 15, 2025
-- Purpose: Minimal configuration database for blog operation

PRAGMA foreign_keys = ON;

-- Admin users table for local authentication
CREATE TABLE admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    active BOOLEAN DEFAULT 1
);

-- External database configurations (AWS RDS, etc.)
CREATE TABLE external_databases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- 'postgresql', 'mysql', etc.
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    database_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL, -- Encrypted password
    ssl_mode TEXT DEFAULT 'require',
    active BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Storage provider configurations (AWS S3, OCI, etc.)
CREATE TABLE storage_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- 'aws_s3', 'oci_object', 'local'
    config_encrypted TEXT NOT NULL, -- JSON configuration, encrypted
    active BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Core system configuration
CREATE TABLE core_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_admin_users_username ON admin_users(username);
CREATE INDEX idx_external_databases_active ON external_databases(active);
CREATE INDEX idx_storage_providers_active ON storage_providers(active);
CREATE INDEX idx_core_config_category ON core_config(category);

-- Initial core configuration
INSERT INTO core_config (key, value, category, description) VALUES 
('blog_title', 'Bedtime Stories', 'general', 'Blog title displayed on frontend'),
('blog_description', 'A collection of bedtime stories', 'general', 'Blog description for SEO'),
('admin_session_timeout', '3600', 'security', 'Admin session timeout in seconds'),
('api_rate_limit', '100', 'security', 'API rate limit per minute'),
('maintenance_mode', 'false', 'system', 'Maintenance mode flag'),
('cors_origin', 'https://bedtime.ingasti.com', 'security', 'CORS allowed origin'),
('max_file_size', '10485760', 'uploads', 'Maximum file upload size in bytes'),
('pagination_size', '10', 'general', 'Default pagination size for posts');

-- Triggers to update timestamps
CREATE TRIGGER update_external_databases_timestamp 
    AFTER UPDATE ON external_databases
    BEGIN
        UPDATE external_databases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_storage_providers_timestamp 
    AFTER UPDATE ON storage_providers
    BEGIN
        UPDATE storage_providers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_core_config_timestamp 
    AFTER UPDATE ON core_config
    BEGIN
        UPDATE core_config SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
    END;