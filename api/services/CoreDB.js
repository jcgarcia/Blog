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
 * CoreDB - Minimal configuration database for blog operation
 * Contains: Admin auth, external DB config, storage providers, core settings
 */
class CoreDB {
    constructor() {
        if (CoreDB.instance) {
            return CoreDB.instance;
        }
        
        this.dbPath = process.env.CORE_DB_PATH || path.join(__dirname, '../config/coredb.sqlite');
        this.db = null;
        this.encryptionKey = process.env.CORE_DB_ENCRYPTION_KEY || this.generateEncryptionKey();
        this.schemaPath = path.join(__dirname, '../config/coredb-schema.sql');
        this.initialized = false;
        
        CoreDB.instance = this;
    }

    /**
     * Initialize CoreDB - create database and run schema
     */
    async initialize() {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Open database connection
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });

            console.log(`🔧 CoreDB: Database opened at ${this.dbPath}`);

            // Check if database needs initialization
            const tables = await this.db.all(
                "SELECT name FROM sqlite_master WHERE type='table'"
            );

            if (tables.length === 0) {
                console.log('🔧 CoreDB: Running initial schema...');
                await this.runSchema();
                await this.createDefaultAdmin();
            }

            // Verify database integrity
            await this.verifySchema();
            
            this.initialized = true;
            console.log('✅ CoreDB: Initialized successfully');

        } catch (error) {
            console.error('❌ CoreDB: Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Run the database schema from SQL file
     */
    async runSchema() {
        try {
            const schema = fs.readFileSync(this.schemaPath, 'utf8');
            await this.db.exec(schema);
            console.log('✅ CoreDB: Schema created successfully');
        } catch (error) {
            console.error('❌ CoreDB: Schema creation failed:', error);
            throw error;
        }
    }

    /**
     * Verify that all required tables exist
     */
    async verifySchema() {
        const requiredTables = ['admin_users', 'external_databases', 'storage_providers', 'core_config'];
        
        for (const table of requiredTables) {
            const exists = await this.db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                [table]
            );
            
            if (!exists) {
                throw new Error(`Required table '${table}' not found in CoreDB`);
            }
        }
        
        console.log('✅ CoreDB: Schema verification passed');
    }

    /**
     * Create default admin user if none exists
     */
    async createDefaultAdmin() {
        const existingAdmin = await this.db.get('SELECT id FROM admin_users LIMIT 1');
        
        if (!existingAdmin) {
            const defaultPassword = 'CoreAdmin2025#Secure'; // Secure default password
            const passwordHash = await argon2.hash(defaultPassword);
            
            await this.db.run(
                `INSERT INTO admin_users (username, password_hash, email) 
                 VALUES (?, ?, ?)`,
                ['coreadmin', passwordHash, 'coreadmin@bedtime.ingasti.com']
            );
            
            console.log('✅ CoreDB: Default admin created');
            console.log('⚠️  Default admin credentials: coreadmin / CoreAdmin2025#Secure');
            console.log('⚠️  CHANGE PASSWORD IMMEDIATELY after first login!');
        }
    }

    /**
     * Authenticate admin user
     */
    async authenticateAdmin(username, password) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const user = await this.db.get(
            'SELECT * FROM admin_users WHERE username = ? AND active = 1',
            [username]
        );

        if (!user) {
            return null;
        }

        const isValid = await argon2.verify(user.password_hash, password);
        
        if (isValid) {
            // Update last login
            await this.db.run(
                'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [user.id]
            );
            
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            };
        }

        return null;
    }

    /**
     * Get active external database configuration
     */
    async getActiveDatabase() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const config = await this.db.get(
            'SELECT * FROM external_databases WHERE active = 1'
        );

        if (config) {
            // Decrypt password
            config.password = this.decrypt(config.password_encrypted);
            delete config.password_encrypted;
        }

        return config;
    }

    /**
     * Get active storage provider configuration
     */
    async getActiveStorageProvider() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const provider = await this.db.get(
            'SELECT * FROM storage_providers WHERE active = 1'
        );

        if (provider) {
            // Decrypt configuration
            provider.config = JSON.parse(this.decrypt(provider.config_encrypted));
            delete provider.config_encrypted;
        }

        return provider;
    }

    /**
     * Get core configuration value
     */
    async getConfig(key) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const result = await this.db.get(
            'SELECT value FROM core_config WHERE key = ?',
            [key]
        );

        return result ? result.value : null;
    }

    /**
     * Get all core configuration
     */
    async getAllConfig() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        return await this.db.all(
            'SELECT key, value, category, description FROM core_config ORDER BY category, key'
        );
    }

    /**
     * Set core configuration value
     */
    async setConfig(key, value, category = 'general', description = '') {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        await this.db.run(
            `INSERT OR REPLACE INTO core_config (key, value, category, description, updated_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [key, value, category, description]
        );
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(text) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedData) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
        
        const [ivHex, encrypted] = encryptedData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Generate encryption key if not provided
     */
    generateEncryptionKey() {
        const key = crypto.randomBytes(32).toString('hex');
        console.log('⚠️  Generated new encryption key for CoreDB');
        console.log('⚠️  Set CORE_DB_ENCRYPTION_KEY environment variable to persist this key');
        return key;
    }

    /**
     * Add external database configuration
     */
    async addExternalDatabase(config) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        // Deactivate current active database if setting this as active
        if (config.active) {
            await this.db.run('UPDATE external_databases SET active = 0');
        }

        const encryptedPassword = this.encrypt(config.password);

        await this.db.run(
            `INSERT INTO external_databases 
             (name, type, host, port, database_name, username, password_encrypted, ssl_mode, active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [config.name, config.type, config.host, config.port, 
             config.database_name, config.username, encryptedPassword, 
             config.ssl_mode || 'require', config.active ? 1 : 0]
        );
    }

    /**
     * Add storage provider configuration
     */
    async addStorageProvider(config) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        // Deactivate current active provider if setting this as active
        if (config.active) {
            await this.db.run('UPDATE storage_providers SET active = 0');
        }

        const encryptedConfig = this.encrypt(JSON.stringify(config.config));

        await this.db.run(
            `INSERT INTO storage_providers (name, type, config_encrypted, active)
             VALUES (?, ?, ?, ?)`,
            [config.name, config.type, encryptedConfig, config.active ? 1 : 0]
        );
    }

    /**
     * Close database connection
     */
    async close() {
        if (this.db) {
            await this.db.close();
            console.log('🔧 CoreDB: Database connection closed');
        }
    }

    /**
     * Get database statistics
     */
    async getStats() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const stats = {};
        
        // Count records in each table
        stats.admin_users = await this.db.get('SELECT COUNT(*) as count FROM admin_users');
        stats.external_databases = await this.db.get('SELECT COUNT(*) as count FROM external_databases');
        stats.storage_providers = await this.db.get('SELECT COUNT(*) as count FROM storage_providers');
        stats.core_config = await this.db.get('SELECT COUNT(*) as count FROM core_config');
        
        // Database file size
        try {
            const stat = fs.statSync(this.dbPath);
            stats.file_size = stat.size;
        } catch (error) {
            stats.file_size = 0;
        }
        
        return stats;
    }
    
    /**
     * Database Connection Management Methods
     */
    
    async getDatabaseConnections() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        const connections = await this.db.all(`
            SELECT id, name, type, host, port, database_name as database, 
                   username, ssl_mode, active, created_at, updated_at
            FROM external_databases 
            ORDER BY name
        `);
        
        return connections;
    }
    
    async getActiveDatabaseConfig() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        const activeDb = await this.db.get(`
            SELECT id, name, type, host, port, database_name as database, 
                   username, password_encrypted, ssl_mode, created_at, updated_at
            FROM external_databases 
            WHERE active = 1
            LIMIT 1
        `);
        
        if (activeDb) {
            // Decrypt password
            activeDb.password = this.decrypt(activeDb.password_encrypted);
            delete activeDb.password_encrypted;
        }
        
        return activeDb;
    }
    
    async createDatabaseConnection(config) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        const { name, type, host, port, database, username, password, ssl_mode } = config;
        
        // Encrypt password
        const encryptedPassword = this.encrypt(password);
        
        const result = await this.db.run(`
            INSERT INTO external_databases 
            (name, type, host, port, database_name, username, password_encrypted, ssl_mode, active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `, [name, type, host, port, database, username, encryptedPassword, ssl_mode]);
        
        console.log(`✅ CoreDB: Database connection '${name}' created`);
        return result.lastID;
    }
    
    async updateDatabaseConnection(id, updateData) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        const updates = [];
        const values = [];
        
        Object.keys(updateData).forEach(key => {
            if (key === 'password') {
                updates.push('password_encrypted = ?');
                values.push(this.encrypt(updateData[key]));
            } else if (key === 'database') {
                updates.push('database_name = ?');
                values.push(updateData[key]);
            } else {
                updates.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });
        
        if (updates.length === 0) {
            throw new Error('No fields to update');
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        
        await this.db.run(`
            UPDATE external_databases 
            SET ${updates.join(', ')}
            WHERE id = ?
        `, values);
        
        console.log(`✅ CoreDB: Database connection ${id} updated`);
    }
    
    async deleteDatabaseConnection(id) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        // Check if this is the active connection
        const activeDb = await this.db.get('SELECT id FROM external_databases WHERE id = ? AND active = 1', [id]);
        if (activeDb) {
            throw new Error('Cannot delete the active database connection. Please switch to another database first.');
        }
        
        await this.db.run('DELETE FROM external_databases WHERE id = ?', [id]);
        console.log(`✅ CoreDB: Database connection ${id} deleted`);
    }
    
    async setActiveDatabaseConnection(id) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        // Deactivate all connections
        await this.db.run('UPDATE external_databases SET active = 0');
        
        // Activate the specified connection
        await this.db.run('UPDATE external_databases SET active = 1 WHERE id = ?', [id]);
        
        console.log(`✅ CoreDB: Database connection ${id} set as active`);
    }
    
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!CoreDB.instance) {
            CoreDB.instance = new CoreDB();
        }
        return CoreDB.instance;
    }
}

// Initialize static instance property
CoreDB.instance = null;

export default CoreDB;