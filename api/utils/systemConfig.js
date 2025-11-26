import { getDbPool } from '../db.js';
import crypto from 'crypto';

/**
 * PostgreSQL System Configuration Manager
 * Handles secure storage and retrieval of API keys and configuration values
 */
class SystemConfigManager {
  async connect() {
    // Pool is managed by db.js singleton
    return Promise.resolve();
  }
  constructor() {
    this.pool = getDbPool();
    this.encryptionKey = process.env.CONFIG_ENCRYPTION_KEY || this.generateEncryptionKey();
  }

  /**
   * Test database connection
   */
  async testConnection() {
    let client;
    try {
      client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      return { success: true, data: result.rows[0] };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Generate encryption key for sensitive data
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(this.encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText) {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(this.encryptionKey, 'hex');
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encrypted = textParts.join(':');
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Get configuration value
   */
  async getConfig(key) {
    try {
      const result = await this.pool.query(
        'SELECT id, config_value, config_type, is_encrypted FROM sys_config WHERE config_key = $1 AND is_active = true',
        [key]
      );
      
      if (result.rows.length === 0) {
        return null;
      }

      const { id, config_value, config_type, is_encrypted } = result.rows[0];
      
      // Log access (use integer id)
      await this.logAudit('sys_config', id, 'ACCESS');
      
      let value = config_value;
      
      // Decrypt if needed
      if (is_encrypted && value) {
        try {
          value = this.decrypt(value);
        } catch (error) {
          console.error('Failed to decrypt config value:', error);
          return null;
        }
      }
      
      // Handle different data types
      if (config_type === 'json') {
        return JSON.parse(value);
      } else if (config_type === 'number') {
        return parseFloat(value);
      } else if (config_type === 'boolean') {
        return value === 'true';
      }
      
      return value;
    } catch (error) {
      console.error('Error getting config:', error);
      return null;
    }
  }

  /**
   * Set configuration value
   */
  async setConfig(key, value, type = 'string', description = null, encrypted = false) {
    try {
      let stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      // Encrypt if needed
      if (encrypted && stringValue) {
        stringValue = this.encrypt(stringValue);
      }
      
      const result = await this.pool.query(
        `INSERT INTO sys_config (config_key, config_value, config_type, description, is_encrypted, updated_by) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         ON CONFLICT (config_key) 
         DO UPDATE SET 
           config_value = $2, 
           config_type = $3, 
           description = COALESCE($4, sys_config.description), 
           is_encrypted = $5,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = $6
         RETURNING id`,
        [key, stringValue, type, description, encrypted, 'system']
      );
      
      // Log the change
      await this.logAudit('sys_config', result.rows[0].id, 'UPDATE', null, { key, value: stringValue });
      
      return { success: true, id: result.rows[0].id };
    } catch (error) {
      console.error('Error setting config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all configuration values
   */
  async getAllConfigs() {
    try {
      const result = await this.pool.query(
        'SELECT config_key, config_value, config_type, description, is_encrypted, created_at, updated_at FROM sys_config WHERE is_active = true ORDER BY config_key'
      );
      
      return result.rows.map(row => ({
        key: row.config_key,
        value: row.is_encrypted ? '[ENCRYPTED]' : row.config_value,
        type: row.config_type,
        description: row.description,
        encrypted: row.is_encrypted,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('Error getting all configs:', error);
      return [];
    }
  }

  /**
   * Get API key
   */
  async getApiKey(serviceName) {
    try {
      const result = await this.pool.query(
        'SELECT id, api_key_encrypted, description FROM sys_api_keys WHERE service_name = $1 AND is_active = true',
        [serviceName]
      );
      
      if (result.rows.length === 0) {
        return null;
      }

      const { id, api_key_encrypted } = result.rows[0];
      
      // Update usage count and last used
      await this.pool.query(
        'UPDATE sys_api_keys SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE service_name = $1',
        [serviceName]
      );
      
      // Log access (use the integer ID)
      await this.logAudit('sys_api_keys', id, 'ACCESS');
      
      // Try to decrypt if it looks encrypted
      if (api_key_encrypted.includes(':')) {
        try {
          return this.decrypt(api_key_encrypted);
        } catch (error) {
          console.error('Failed to decrypt API key:', error);
          return null;
        }
      }
      
      return api_key_encrypted;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  /**
   * Set API key
   */
  async setApiKey(serviceName, keyValue, description = null, options = {}) {
    try {
      const {
        encrypt = true,
        expiresAt = null
      } = options;

      let encryptedKey = keyValue;
      if (encrypt && keyValue) {
        encryptedKey = this.encrypt(keyValue);
      }

      const result = await this.pool.query(
        `INSERT INTO sys_api_keys (service_name, api_key_encrypted, description, expires_at, updated_by) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (service_name) 
         DO UPDATE SET 
           api_key_encrypted = $2, 
           description = COALESCE($3, sys_api_keys.description), 
           expires_at = $4,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = $5
         RETURNING id`,
        [serviceName, encryptedKey, description, expiresAt, 'system']
      );
      
      // Log the change
      await this.logAudit('sys_api_keys', result.rows[0].id, 'UPDATE', null, { service: serviceName, keyLength: keyValue.length });
      
      return { success: true, id: result.rows[0].id };
    } catch (error) {
      console.error('Error setting API key:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate API key
   */
  async validateApiKey(keyValue) {
    try {
      const result = await this.pool.query(
        `SELECT service_name, description, expires_at 
         FROM sys_api_keys 
         WHERE api_key_encrypted = $1 AND is_active = true 
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [keyValue]
      );
      
      if (result.rows.length === 0) {
        return { valid: false, reason: 'Invalid or expired API key' };
      }

      const apiKey = result.rows[0];
      
      // Update usage count
      await this.pool.query(
        'UPDATE sys_api_keys SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE api_key_encrypted = $1',
        [keyValue]
      );
      
      return { 
        valid: true, 
        serviceName: apiKey.service_name,
        description: apiKey.description
      };
    } catch (error) {
      console.error('Error validating API key:', error);
      return { valid: false, reason: 'Database error' };
    }
  }

  /**
   * Get all API keys (without actual key values)
   */
  async getAllApiKeys() {
    try {
      const result = await this.pool.query(
        `SELECT service_name, description, usage_count, last_used_at, expires_at, is_active, created_at, updated_at 
         FROM sys_api_keys 
         ORDER BY created_at DESC`
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting all API keys:', error);
      return [];
    }
  }

  /**
   * Log audit entry
   */
  async logAudit(tableName, recordId, operation, oldValues = null, newValues = null, userId = null, ipAddress = null, userAgent = null) {
    try {
      await this.pool.query(
        `INSERT INTO sys_config_audit (table_name, record_id, operation, old_values, new_values, changed_by, ip_address, user_agent) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [tableName, recordId, operation, oldValues, newValues, userId || 'system', ipAddress, userAgent]
      );
    } catch (error) {
      console.error('Error logging audit:', error);
      // Don't throw error to prevent audit failures from breaking main operations
    }
  }

  /**
   * Alternative method for audit logging with proper access tracking
   */
  async logAccess(tableName, recordId, operation, oldValues = null, newValues = null, userId = null, ipAddress = null, userAgent = null) {
    return this.logAudit(tableName, recordId, operation, oldValues, newValues, userId, ipAddress, userAgent);
  }

  /**
   * Get audit log
   */
  async getAuditLog(limit = 100, offset = 0) {
    try {
      const result = await this.pool.query(
        `SELECT table_name, record_id, operation, old_values, new_values, changed_by, ip_address, changed_at 
         FROM sys_config_audit 
         ORDER BY changed_at DESC 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting audit log:', error);
      return [];
    }
  }

  /**
   * Get system statistics
   */
  async getStats() {
    try {
      const configCount = await this.pool.query('SELECT COUNT(*) as count FROM sys_config WHERE is_active = true');
      const apiKeyCount = await this.pool.query('SELECT COUNT(*) as count FROM sys_api_keys WHERE is_active = true');
      const auditCount = await this.pool.query('SELECT COUNT(*) as count FROM sys_config_audit');
      
      return {
        configurations: parseInt(configCount.rows[0].count),
        apiKeys: parseInt(apiKeyCount.rows[0].count),
        auditEntries: parseInt(auditCount.rows[0].count)
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { configurations: 0, apiKeys: 0, auditEntries: 0 };
    }
  }

}

export default SystemConfigManager;
