-- Modified System Configuration Schema for Blog Database
-- This version uses your dedicated 'blog' database with prefixed table names
-- to avoid conflicts with existing blog tables

-- Use your dedicated blog database
USE blog;

-- Table for storing system configuration values (prefixed with sys_)
CREATE TABLE IF NOT EXISTS sys_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(255) NOT NULL UNIQUE,
    config_value TEXT,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100) DEFAULT 'system',
    INDEX idx_config_key (config_key)
);

-- Table for storing API keys with additional metadata (prefixed with sys_)
CREATE TABLE IF NOT EXISTS sys_api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL UNIQUE,
    api_key_encrypted TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100) DEFAULT 'system',
    expires_at TIMESTAMP NULL,
    INDEX idx_service_name (service_name)
);

-- Table for audit logging (prefixed with sys_)
CREATE TABLE IF NOT EXISTS sys_config_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    record_id INT,
    old_values JSON,
    new_values JSON,
    changed_by VARCHAR(100) DEFAULT 'system',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    INDEX idx_table_operation (table_name, operation),
    INDEX idx_changed_at (changed_at)
);

-- Insert initial configuration values
INSERT INTO sys_config_values (config_key, config_value, description, category) VALUES
('blog_api_url', 'https://bapi.ingasti.com/api', 'Blog API base URL', 'blog'),
('blog_user_id', '1', 'Default user ID for blog posts', 'blog'),
('max_file_size', '5242880', 'Maximum file size for uploads (5MB)', 'upload'),
('allowed_file_types', 'md,txt', 'Allowed file types for upload', 'upload'),
('rate_limit_requests', '100', 'Rate limit requests per hour', 'security'),
('rate_limit_window', '3600', 'Rate limit window in seconds', 'security'),
('jwt_expiry', '24h', 'JWT token expiry time', 'auth'),
('session_timeout', '1800', 'Session timeout in seconds', 'auth');

-- Insert API keys (placeholders - will be updated with real values)
INSERT INTO sys_api_keys (key_name, key_value, description, service, environment) VALUES
('blog_publish_api_key', 'PLACEHOLDER_REPLACE_WITH_SECURE_KEY', 'API key for automated blog publishing', 'blog', 'production'),
('blog_publish_api_key_dev', 'PLACEHOLDER_REPLACE_WITH_DEV_KEY', 'API key for development blog publishing', 'blog', 'development'),
('github_webhook_secret', 'PLACEHOLDER_REPLACE_WITH_GITHUB_SECRET', 'GitHub webhook secret for CI/CD', 'github', 'production'),
('monitoring_api_key', 'PLACEHOLDER_REPLACE_WITH_MONITORING_KEY', 'API key for system monitoring', 'monitoring', 'production');

-- Sample queries for application use:
-- SELECT config_value FROM sys_config_values WHERE config_key = 'blog_api_url';
-- SELECT key_value FROM sys_api_keys WHERE key_name = 'blog_publish_api_key' AND is_active = TRUE;
-- UPDATE sys_api_keys SET last_used_at = NOW(), usage_count = usage_count + 1 WHERE key_name = 'blog_publish_api_key';
