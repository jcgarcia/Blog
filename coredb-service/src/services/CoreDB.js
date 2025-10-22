import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import argon2 from 'argon2';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * CoreDB - Independent microservice for blog configuration management
 * Contains: Admin auth, external DB config, storage providers, core settings
 * Fixed: Always uses Jenkins-provided encryption key, never generates fallback keys
 */
class CoreDB {
    constructor() {
        if (CoreDB.instance) {
            return CoreDB.instance;
        }
        
        // Use persistent data directory
        this.dbPath = process.env.CORE_DB_PATH || path.join(__dirname, '../../data/coredb.sqlite');
        this.db = null;
        
        // CRITICAL FIX: Never generate fallback encryption key
        // This must come from Jenkins credential or the service should fail
        if (!process.env.COREDB_ENCRYPTION_KEY) {
            throw new Error('COREDB_ENCRYPTION_KEY environment variable is required and must be provided by Jenkins');
        }
        this.encryptionKey = process.env.COREDB_ENCRYPTION_KEY;
        
        this.schemaPath = path.join(__dirname, '../config/coredb-schema.sql');
        this.initialized = false;
        
        CoreDB.instance = this;
    }

    /**
     * Singleton pattern - ensures single instance across the service
     */
    static getInstance() {
        if (!CoreDB.instance) {
            CoreDB.instance = new CoreDB();
        }
        return CoreDB.instance;
    }

    /**
     * Initialize CoreDB - create database and run schema
     */
    async initialize() {
        try {
            // Ensure data directory exists
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 CoreDB: Created data directory ${dir}`);
            }

            // Open database connection
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });

            console.log(`🔧 CoreDB: Database opened at ${this.dbPath}`);
            console.log(`🔑 CoreDB: Using encryption key from COREDB_ENCRYPTION_KEY`);

            // Check if database needs initialization
            const tables = await this.db.all("SELECT name FROM sqlite_master WHERE type='table'");
            
            if (tables.length === 0) {
                console.log('🔧 CoreDB: Running initial schema...');
                await this.runSchema();
            } else {
                console.log(`🔧 CoreDB: Found ${tables.length} existing tables`);
            }

            this.initialized = true;
            console.log('✅ CoreDB: Initialized successfully');

        } catch (error) {
            console.error('❌ CoreDB: Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Run database schema
     */
    async runSchema() {
        const schema = `
            -- Admin users table
            CREATE TABLE IF NOT EXISTS admin_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            );

            -- Database connections table
            CREATE TABLE IF NOT EXISTS database_connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'postgresql',
                host TEXT NOT NULL,
                port INTEGER NOT NULL DEFAULT 5432,
                database_name TEXT NOT NULL,
                username TEXT NOT NULL,
                password_encrypted TEXT NOT NULL,
                is_active BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Storage providers table
            CREATE TABLE IF NOT EXISTS storage_providers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                config_encrypted TEXT NOT NULL,
                is_active BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- System configuration table
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Insert default admin user (password: Aa123456)
            INSERT OR IGNORE INTO admin_users (username, password_hash) 
            VALUES ('admin', '$argon2id$v=19$m=65536,t=3,p=4$YourSaltHere$HashHere');
        `;

        await this.db.exec(schema);
        console.log('✅ CoreDB: Schema executed successfully');
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(text) {
        if (!text) return null;
        
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipherGCM('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'));
            cipher.setIVLength(16);
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('❌ CoreDB: Encryption failed:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedText) {
        if (!encryptedText) return null;
        
        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }
            
            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];
            
            const decipher = crypto.createDecipherGCM('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'));
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('❌ CoreDB: Decryption failed:', error);
            throw new Error('Failed to decrypt data - encryption key mismatch');
        }
    }

    /**
     * Get all database connections
     */
    async getDatabaseConnections() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        try {
            const connections = await this.db.all(`
                SELECT id, name, type, host, port, database_name, username, is_active, created_at, updated_at
                FROM database_connections
                ORDER BY created_at DESC
            `);

            // Decrypt passwords for each connection
            return connections.map(conn => ({
                ...conn,
                password: this.decrypt(conn.password_encrypted)
            }));
        } catch (error) {
            console.error('❌ CoreDB: Error fetching connections:', error);
            throw error;
        }
    }

    /**
     * Create new database connection
     */
    async createDatabaseConnection(connectionData) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const { name, type = 'postgresql', host, port = 5432, database_name, username, password } = connectionData;

        if (!name || !host || !database_name || !username || !password) {
            throw new Error('Missing required connection parameters');
        }

        try {
            // Encrypt password
            const encryptedPassword = this.encrypt(password);

            // Deactivate other connections if this is being set as active
            if (connectionData.is_active) {
                await this.db.run('UPDATE database_connections SET is_active = FALSE');
            }

            const result = await this.db.run(`
                INSERT INTO database_connections (name, type, host, port, database_name, username, password_encrypted, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [name, type, host, port, database_name, username, encryptedPassword, connectionData.is_active || false]);

            console.log(`✅ CoreDB: Database connection '${name}' created with ID ${result.lastID}`);
            return result.lastID;
        } catch (error) {
            console.error('❌ CoreDB: Error creating connection:', error);
            throw error;
        }
    }

    /**
     * Update database connection
     */
    async updateDatabaseConnection(id, updates) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        try {
            const setClause = [];
            const values = [];

            // Handle password encryption
            if (updates.password) {
                setClause.push('password_encrypted = ?');
                values.push(this.encrypt(updates.password));
                delete updates.password;
            }

            // Handle other updates
            for (const [key, value] of Object.entries(updates)) {
                if (key === 'password') continue; // Already handled
                setClause.push(`${key} = ?`);
                values.push(value);
            }

            if (setClause.length === 0) {
                throw new Error('No valid updates provided');
            }

            // Add updated_at
            setClause.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);

            const result = await this.db.run(`
                UPDATE database_connections 
                SET ${setClause.join(', ')}
                WHERE id = ?
            `, values);

            if (result.changes === 0) {
                throw new Error('Connection not found');
            }

            console.log(`✅ CoreDB: Database connection ${id} updated`);
            return true;
        } catch (error) {
            console.error('❌ CoreDB: Error updating connection:', error);
            throw error;
        }
    }

    /**
     * Delete database connection
     */
    async deleteDatabaseConnection(id) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        try {
            const result = await this.db.run('DELETE FROM database_connections WHERE id = ?', [id]);
            
            if (result.changes === 0) {
                throw new Error('Connection not found');
            }

            console.log(`✅ CoreDB: Database connection ${id} deleted`);
            return true;
        } catch (error) {
            console.error('❌ CoreDB: Error deleting connection:', error);
            throw error;
        }
    }

    /**
     * Get active database connection
     */
    async getActiveDatabaseConnection() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        try {
            const connection = await this.db.get(`
                SELECT id, name, type, host, port, database_name, username, password_encrypted, created_at, updated_at
                FROM database_connections 
                WHERE is_active = TRUE
                LIMIT 1
            `);

            if (!connection) {
                return null;
            }

            return {
                ...connection,
                password: this.decrypt(connection.password_encrypted)
            };
        } catch (error) {
            console.error('❌ CoreDB: Error fetching active connection:', error);
            throw error;
        }
    }

    /**
     * Set active database connection
     */
    async setActiveDatabaseConnection(id) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        try {
            // Start transaction
            await this.db.run('BEGIN TRANSACTION');

            // Deactivate all connections
            await this.db.run('UPDATE database_connections SET is_active = FALSE');

            // Activate specified connection
            const result = await this.db.run('UPDATE database_connections SET is_active = TRUE WHERE id = ?', [id]);

            if (result.changes === 0) {
                await this.db.run('ROLLBACK');
                throw new Error('Connection not found');
            }

            await this.db.run('COMMIT');
            console.log(`✅ CoreDB: Database connection ${id} set as active`);
            return true;
        } catch (error) {
            await this.db.run('ROLLBACK');
            console.error('❌ CoreDB: Error setting active connection:', error);
            throw error;
        }
    }

    /**
     * Verify admin credentials
     */
    async verifyAdmin(username, password) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        try {
            const user = await this.db.get('SELECT * FROM admin_users WHERE username = ?', [username]);
            
            if (!user) {
                return false;
            }

            const isValid = await argon2.verify(user.password_hash, password);
            
            if (isValid) {
                // Update last login
                await this.db.run('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
            }

            return isValid;
        } catch (error) {
            console.error('❌ CoreDB: Error verifying admin:', error);
            return false;
        }
    }

    /**
     * Get service health status
     */
    async getHealthStatus() {
        try {
            if (!this.initialized || !this.db) {
                return {
                    status: 'unhealthy',
                    database: 'not_initialized',
                    encryption: 'unknown'
                };
            }

            // Test database connection
            await this.db.get('SELECT 1');

            // Test encryption/decryption
            const testData = 'test-encryption-' + Date.now();
            const encrypted = this.encrypt(testData);
            const decrypted = this.decrypt(encrypted);

            const isEncryptionWorking = testData === decrypted;

            return {
                status: 'healthy',
                database: 'connected',
                encryption: isEncryptionWorking ? 'working' : 'failed',
                encryption_key_source: 'jenkins_credential'
            };
        } catch (error) {
            console.error('❌ CoreDB: Health check failed:', error);
            return {
                status: 'unhealthy',
                database: 'error',
                encryption: 'error',
                error: error.message
            };
        }
    }

    /**
     * Emergency: Clear all database connections (for corruption recovery)
     */
    async clearAllConnections() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        try {
            const result = await this.db.run('DELETE FROM database_connections');
            console.log(`🚨 CoreDB: Emergency cleared ${result.changes} database connections`);
            return result.changes;
        } catch (error) {
            console.error('❌ CoreDB: Error clearing connections:', error);
            throw error;
        }
    }
}

export default CoreDB;