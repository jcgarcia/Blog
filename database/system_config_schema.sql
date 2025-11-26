-- System Configuration Database Schema
-- This schema adds secure system configuration tables to the existing blog database
-- Use the existing 'blog' database on Aiven

USE blog;

-- Table for storing system configuration values
CREATE TABLE IF NOT EXISTS config_values (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(255) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'general',
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    
    INDEX idx_config_key (config_key),
    INDEX idx_category (category)
);

-- Table for storing API keys with additional metadata
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(255) NOT NULL UNIQUE,
    key_value VARCHAR(512) NOT NULL,
    description TEXT,
    service VARCHAR(100) NOT NULL,
    environment VARCHAR(50) DEFAULT 'production',
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NULL,
    last_used_at TIMESTAMP NULL,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    
    INDEX idx_key_name (key_name),
    INDEX idx_service (service),
    INDEX idx_environment (environment),
    INDEX idx_is_active (is_active)
);

-- Table for audit logging
CREATE TABLE IF NOT EXISTS config_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INT NOT NULL,
    action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, ACCESS
    old_value TEXT,
    new_value TEXT,
    changed_by VARCHAR(100) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    INDEX idx_table_record (table_name, record_id),
    INDEX idx_action (action),
    INDEX idx_changed_at (changed_at)
);

-- Insert initial configuration values
INSERT INTO config_values (config_key, config_value, description, category) VALUES
('blog_api_url', 'https://bapi.ingasti.com/api', 'Blog API base URL', 'blog'),
('blog_user_id', '1', 'Default user ID for blog posts', 'blog'),
('max_file_size', '5242880', 'Maximum file size for uploads (5MB)', 'upload'),
('allowed_file_types', 'md,txt', 'Allowed file types for upload', 'upload'),
('rate_limit_requests', '100', 'Rate limit requests per hour', 'security'),
('rate_limit_window', '3600', 'Rate limit window in seconds', 'security'),
('jwt_expiry', '24h', 'JWT token expiry time', 'auth'),
('session_timeout', '1800', 'Session timeout in seconds', 'auth');

-- Insert API keys (you'll need to update these with real values)
INSERT INTO api_keys (key_name, key_value, description, service, environment) VALUES
('blog_publish_api_key', 'PLACEHOLDER_REPLACE_WITH_SECURE_KEY', 'API key for automated blog publishing', 'blog', 'production'),
('blog_publish_api_key_dev', 'PLACEHOLDER_REPLACE_WITH_DEV_KEY', 'API key for development blog publishing', 'blog', 'development'),
('github_webhook_secret', 'PLACEHOLDER_REPLACE_WITH_GITHUB_SECRET', 'GitHub webhook secret for CI/CD', 'github', 'production'),
('monitoring_api_key', 'PLACEHOLDER_REPLACE_WITH_MONITORING_KEY', 'API key for system monitoring', 'monitoring', 'production');

-- Create a user for the application to use
CREATE USER IF NOT EXISTS 'blog_config_user'@'%' IDENTIFIED BY 'SECURE_PASSWORD_REPLACE_ME';
GRANT SELECT, INSERT, UPDATE ON system_config.* TO 'blog_config_user'@'%';
FLUSH PRIVILEGES;

-- Sample queries for application use:
-- SELECT config_value FROM config_values WHERE config_key = 'blog_api_url';
-- SELECT key_value FROM api_keys WHERE key_name = 'blog_publish_api_key' AND is_active = TRUE;
-- UPDATE api_keys SET last_used_at = NOW(), usage_count = usage_count + 1 WHERE key_name = 'blog_publish_api_key';
