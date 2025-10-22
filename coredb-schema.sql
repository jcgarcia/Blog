-- ============================================================================
-- CoreDB PostgreSQL Schema
-- Bedtime Blog Configuration Database
-- ============================================================================

-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Admin Users Table
-- Stores admin authentication credentials for system access
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- Argon2 hash
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- ============================================================================
-- Database Connections Table  
-- Stores encrypted connection strings for external databases
-- ============================================================================
CREATE TABLE IF NOT EXISTS database_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'postgresql', -- postgresql, mysql, etc
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 5432,
    database_name VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_encrypted TEXT NOT NULL, -- AES encrypted password
    ssl_mode VARCHAR(20) DEFAULT 'prefer', -- disable, allow, prefer, require
    connection_options JSONB DEFAULT '{}', -- Additional connection parameters
    is_active BOOLEAN DEFAULT false, -- Only one can be active at a time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    
    -- Ensure only one active connection
    CONSTRAINT unique_active_connection EXCLUDE (is_active WITH =) WHERE (is_active = true)
);

-- ============================================================================
-- Storage Providers Table
-- Stores encrypted configuration for storage providers (AWS S3, etc)
-- ============================================================================
CREATE TABLE IF NOT EXISTS storage_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    provider_type VARCHAR(50) NOT NULL, -- s3, gcs, azure, local
    config_encrypted TEXT NOT NULL, -- AES encrypted JSON configuration
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    
    -- Ensure only one active provider per type
    CONSTRAINT unique_active_provider EXCLUDE (provider_type, is_active WITH =) WHERE (is_active = true)
);

-- ============================================================================
-- System Configuration Table
-- Stores system-wide configuration settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value_encrypted TEXT, -- AES encrypted value (if sensitive)
    value_plain TEXT, -- Plain text value (if not sensitive) 
    is_encrypted BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES admin_users(id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_database_connections_active ON database_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_storage_providers_active ON storage_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_storage_providers_type ON storage_providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- ============================================================================
-- Update Timestamp Triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to all tables
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_database_connections_updated_at BEFORE UPDATE ON database_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_storage_providers_updated_at BEFORE UPDATE ON storage_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Initial Data
-- ============================================================================

-- Create default admin user (password: 'Aa123456' - change after first login)
-- Argon2 hash of 'Aa123456': $argon2id$v=19$m=65536,t=3,p=4$...
INSERT INTO admin_users (username, password_hash, email, is_active) 
VALUES ('admin', '$argon2id$v=19$m=65536,t=3,p=4$YWRtaW5zZWVk$1vVrOmHzQjK8VKGZf8h2kJ+5N9o8Q2rX3wL6vM1yH4A', 'admin@blog.local', true)
ON CONFLICT (username) DO NOTHING;

-- Insert default system configuration
INSERT INTO system_config (key, value_plain, is_encrypted, description) VALUES
('system_name', 'Bedtime Blog', false, 'Application name'),
('system_version', '2.0.0', false, 'Current system version'),
('initialized_at', NOW()::text, false, 'System initialization timestamp'),
('encryption_key_version', '1', false, 'Current encryption key version')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================
COMMENT ON TABLE admin_users IS 'System administrators with access to CoreDB management';
COMMENT ON TABLE database_connections IS 'External database connections with encrypted credentials';
COMMENT ON TABLE storage_providers IS 'Storage provider configurations (S3, etc) with encrypted credentials';
COMMENT ON TABLE system_config IS 'System-wide configuration settings';

COMMENT ON COLUMN database_connections.password_encrypted IS 'AES-256-GCM encrypted database password';
COMMENT ON COLUMN storage_providers.config_encrypted IS 'AES-256-GCM encrypted provider configuration JSON';
COMMENT ON COLUMN system_config.value_encrypted IS 'AES-256-GCM encrypted configuration value';

-- ============================================================================
-- Security Notes
-- ============================================================================
-- 1. All sensitive data (passwords, API keys) are encrypted using AES-256-GCM
-- 2. Encryption key is provided via environment variable COREDB_ENCRYPTION_KEY
-- 3. Only one database connection and one storage provider per type can be active
-- 4. All tables have updated_at triggers for audit trail
-- 5. UUID primary keys for better security and scalability
-- ============================================================================