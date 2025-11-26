-- System Configuration Database Schema for PostgreSQL
-- This schema creates secure system configuration tables for PostgreSQL

-- Connect to your PostgreSQL database
-- \c blog;

-- Enable UUID extension for better primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for storing system configuration values
CREATE TABLE IF NOT EXISTS sys_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) NOT NULL UNIQUE,
    config_value TEXT,
    config_type VARCHAR(50) DEFAULT 'string', -- string, json, encrypted, number, boolean
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100) DEFAULT 'system'
);

-- Table for storing API keys with metadata
CREATE TABLE IF NOT EXISTS sys_api_keys (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL UNIQUE,
    api_key_encrypted TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    updated_by VARCHAR(100) DEFAULT 'system',
    expires_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP
);

-- Table for audit logging
CREATE TABLE IF NOT EXISTS sys_config_audit (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE, ACCESS
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    changed_by VARCHAR(100) DEFAULT 'system',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sys_config_key ON sys_config(config_key);
CREATE INDEX IF NOT EXISTS idx_sys_config_active ON sys_config(is_active);
CREATE INDEX IF NOT EXISTS idx_sys_api_keys_service ON sys_api_keys(service_name);
CREATE INDEX IF NOT EXISTS idx_sys_api_keys_active ON sys_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_sys_audit_table ON sys_config_audit(table_name);
CREATE INDEX IF NOT EXISTS idx_sys_audit_time ON sys_config_audit(changed_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_sys_config_updated_at 
    BEFORE UPDATE ON sys_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sys_api_keys_updated_at 
    BEFORE UPDATE ON sys_api_keys 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default configuration values
INSERT INTO sys_config (config_key, config_value, config_type, description) VALUES
('blog.api_url', 'https://bapi.ingasti.com', 'string', 'Blog API base URL'),
('blog.user_id', '1', 'number', 'Default user ID for blog posts'),
('blog.max_file_size', '10485760', 'number', 'Maximum file size in bytes (10MB)'),
('blog.allowed_file_types', '["md", "txt", "json"]', 'json', 'Allowed file types for upload'),
('blog.auto_publish', 'true', 'boolean', 'Auto-publish posts when uploaded'),
('blog.posts_per_page', '10', 'number', 'Number of posts per page'),
('system.version', '1.0.0', 'string', 'System configuration version'),
('system.environment', 'production', 'string', 'Current environment'),
('system.debug_mode', 'false', 'boolean', 'Enable debug logging'),
('system.maintenance_mode', 'false', 'boolean', 'Enable maintenance mode'),
('backup.retention_days', '30', 'number', 'Days to retain backups'),
('security.rate_limit', '100', 'number', 'API rate limit per hour')
ON CONFLICT (config_key) DO NOTHING;

-- Insert default API key placeholder (will be updated with actual key)
INSERT INTO sys_api_keys (service_name, api_key_encrypted, description) VALUES
('blog_publish', 'placeholder-key-will-be-updated', 'API key for blog post publishing'),
('openai', 'placeholder-key-will-be-updated', 'OpenAI API key for content generation'),
('anthropic', 'placeholder-key-will-be-updated', 'Anthropic API key for content generation')
ON CONFLICT (service_name) DO NOTHING;

-- Display setup completion
SELECT 'PostgreSQL System Configuration Schema Created Successfully' AS status;
SELECT COUNT(*) as config_entries FROM sys_config;
SELECT COUNT(*) as api_keys FROM sys_api_keys;
SELECT COUNT(*) as audit_logs FROM sys_config_audit;
