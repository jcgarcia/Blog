import pkg from 'pg';
const { Pool } = pkg;
import argon2 from 'argon2';
import crypto from 'crypto';

/**
 * CoreDB Microservice - PostgreSQL-based configuration database
 * Contains: Admin auth, external DB config, storage providers, core settings
 * COMPLETELY PostgreSQL - NO SQLite references
 * Designed for independent microservice deployment
 */
class CoreDB {
    constructor() {
        if (CoreDB.instance) {
            return CoreDB.instance;
        }
        
        // PostgreSQL connection configuration - CONNECTS TO COREDB DATABASE
        this.connectionConfig = {
            host: process.env.COREDB_HOST || 'blog-postgres-service',
            port: process.env.COREDB_PORT || 5432,
            database: process.env.COREDB_DATABASE || 'coredb',  // CRITICAL: CoreDB connects to 'coredb' database
            user: process.env.PGUSER || 'dbcore_usr_2025',  // Use correct PostgreSQL user
            password: process.env.PGPASSWORD || 'DbSecure2025#XpL3vN7wE5xT6gH4uY1zC0',
            ssl: false,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };
        
        this.pool = null;
        
        // CRITICAL: Must use Jenkins credentials
        if (!process.env.COREDB_ENCRYPTION_KEY) {
            throw new Error('COREDB_ENCRYPTION_KEY environment variable is required. Check Jenkins credentials.');
        }
        if (!this.connectionConfig.password) {
            throw new Error('PGPASSWORD environment variable is required. Check Jenkins credentials.');
        }
        this.encryptionKey = process.env.COREDB_ENCRYPTION_KEY;
        
        this.initialized = false;
        
        CoreDB.instance = this;
    }

    /**
     * Initialize CoreDB microservice - create PostgreSQL connection and schema
     */
    async initialize() {
        try {
            // Create PostgreSQL connection pool
            this.pool = new Pool(this.connectionConfig);
            
            console.log(`🔧 CoreDB Microservice: PostgreSQL pool created for ${this.connectionConfig.host}:${this.connectionConfig.port}/${this.connectionConfig.database}`);
            
            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            
            // Check if CoreDB tables exist
            const result = await this.pool.query(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('admin_users', 'database_connections', 'storage_providers', 'system_config')"
            );
            
            if (result.rows.length < 4) {
                console.log('🔧 CoreDB Microservice: Running PostgreSQL schema initialization...');
                await this.createMinimalSchema();
            }
            
            // Verify database integrity
            await this.verifySchema();
            
            this.initialized = true;
            console.log('✅ CoreDB Microservice: Initialized successfully');
            
        } catch (error) {
            console.error('❌ CoreDB Microservice: Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Create minimal schema 
     */
    async createMinimalSchema() {
        const schema = `
            -- Admin Users
            CREATE TABLE IF NOT EXISTS admin_users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role VARCHAR(50) DEFAULT 'admin',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                last_login TIMESTAMP
            );
            
            -- Database Connections
            CREATE TABLE IF NOT EXISTS database_connections (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                host VARCHAR(255) NOT NULL,
                port INTEGER NOT NULL,
                database_name VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL,
                password_encrypted TEXT NOT NULL,
                ssl_mode VARCHAR(50) DEFAULT 'prefer',
                is_active BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            
            -- Storage Providers
            CREATE TABLE IF NOT EXISTS storage_providers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                config_encrypted TEXT NOT NULL,
                active BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            
            -- System Configuration
            CREATE TABLE IF NOT EXISTS system_config (
                id SERIAL PRIMARY KEY,
                key VARCHAR(255) UNIQUE NOT NULL,
                value TEXT,
                category VARCHAR(100) DEFAULT 'general',
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            
            -- Create default admin user if not exists
            INSERT INTO admin_users (username, email, password_hash)
            VALUES ('coreadmin', 'admin@coredb.local', '$argon2id$v=19$m=65536,t=3,p=4$CZKqNvOgAfXV5aEKr3fzAA$gDvtpI1rNjRFpXDCKxpS5EIJM2Z1tIGBSVVoHyHzZME')
            ON CONFLICT (username) DO NOTHING;
        `;
        
        await this.pool.query(schema);
        console.log('✅ CoreDB Microservice: Minimal schema created');
    }

    /**
     * Verify that all required tables exist
     */
    async verifySchema() {
        const requiredTables = ['admin_users', 'database_connections', 'storage_providers', 'system_config'];
        
        for (const table of requiredTables) {
            const result = await this.pool.query(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
                [table]
            );
            
            if (result.rows.length === 0) {
                throw new Error(`Required table '${table}' not found in CoreDB`);
            }
        }
        
        console.log('✅ CoreDB Microservice: Schema verification passed');
    }

    /**
     * Health check endpoint
     */
    async healthCheck() {
        try {
            if (!this.pool) {
                return { status: 'error', message: 'Database pool not initialized' };
            }
            
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW() as timestamp');
            client.release();
            
            return {
                status: 'healthy',
                timestamp: result.rows[0].timestamp,
                database: this.connectionConfig.database,
                host: this.connectionConfig.host
            };
        } catch (error) {
            return {
                status: 'error',
                message: error.message
            };
        }
    }

    /**
     * Authenticate admin user
     */
    async authenticateAdmin(username, password) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const result = await this.pool.query(
            'SELECT * FROM admin_users WHERE username = $1 AND is_active = true',
            [username]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const user = result.rows[0];
        const isValid = await argon2.verify(user.password_hash, password);
        
        if (isValid) {
            // Update last login
            await this.pool.query(
                'UPDATE admin_users SET last_login = NOW() WHERE id = $1',
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

        const result = await this.pool.query(
            'SELECT * FROM database_connections WHERE is_active = true'
        );

        if (result.rows.length > 0) {
            const config = result.rows[0];
            // Decrypt password
            config.password = this.decrypt(config.password_encrypted);
            delete config.password_encrypted;
            return config;
        }

        return null;
    }

    /**
     * Get active storage provider configuration
     */
    async getActiveStorageProvider() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const result = await this.pool.query(
            'SELECT * FROM storage_providers WHERE active = true'
        );

        if (result.rows.length > 0) {
            const provider = result.rows[0];
            // Decrypt configuration
            provider.config = JSON.parse(this.decrypt(provider.config_encrypted));
            delete provider.config_encrypted;
            return provider;
        }

        return null;
    }

    /**
     * Get core configuration value
     */
    async getConfig(key) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const result = await this.pool.query(
            'SELECT value FROM system_config WHERE key = $1',
            [key]
        );

        return result.rows.length > 0 ? result.rows[0].value : null;
    }

    /**
     * Get all core configuration
     */
    async getAllConfig() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const result = await this.pool.query(
            'SELECT key, value, category, description FROM system_config ORDER BY category, key'
        );

        return result.rows;
    }

    /**
     * Set core configuration value
     */
    async setConfig(key, value, category = 'general', description = '') {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        await this.pool.query(
            `INSERT INTO system_config (key, value, category, description, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (key) DO UPDATE SET
             value = EXCLUDED.value,
             category = EXCLUDED.category,
             description = EXCLUDED.description,
             updated_at = NOW()`,
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
     * Database Connection Management Methods
     */
    
    async getDatabaseConnections() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        const result = await this.pool.query(`
            SELECT id, name, type, host, port, database_name as database,
                   username, ssl_mode, is_active as active, created_at, updated_at
            FROM database_connections 
            ORDER BY name
        `);
        
        return result.rows;
    }

    async getActiveDatabaseConfig() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        const result = await this.pool.query(`
            SELECT id, name, type, host, port, database_name as database, 
                   username, password_encrypted, ssl_mode, created_at, updated_at
            FROM database_connections 
            WHERE is_active = true
            LIMIT 1
        `);
        
        if (result.rows.length > 0) {
            const activeDb = result.rows[0];
            // Decrypt password
            activeDb.password = this.decrypt(activeDb.password_encrypted);
            delete activeDb.password_encrypted;
            return activeDb;
        }
        
        return null;
    }

    async createDatabaseConnection(config) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        const { name, type, host, port, database, username, password, ssl_mode } = config;
        
        // Encrypt password
        const encryptedPassword = this.encrypt(password);
        
        const result = await this.pool.query(`
            INSERT INTO database_connections 
            (name, type, host, port, database_name, username, password_encrypted, ssl_mode, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
            RETURNING id
        `, [name, type, host, port, database, username, encryptedPassword, ssl_mode]);
        
        console.log(`✅ CoreDB Microservice: Database connection '${name}' created`);
        return result.rows[0].id;
    }
    
    async updateDatabaseConnection(id, updateData) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        Object.keys(updateData).forEach(key => {
            if (key === 'password') {
                updates.push(`password_encrypted = $${paramIndex++}`);
                values.push(this.encrypt(updateData[key]));
            } else if (key === 'database') {
                updates.push(`database_name = $${paramIndex++}`);
                values.push(updateData[key]);
            } else if (key === 'active') {
                updates.push(`is_active = $${paramIndex++}`);
                values.push(updateData[key]);
            } else {
                updates.push(`${key} = $${paramIndex++}`);
                values.push(updateData[key]);
            }
        });
        
        if (updates.length === 0) {
            throw new Error('No fields to update');
        }
        
        updates.push(`updated_at = NOW()`);
        values.push(id);
        
        await this.pool.query(`
            UPDATE database_connections 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
        `, values);
        
        console.log(`✅ CoreDB Microservice: Database connection ${id} updated`);
    }
    
    async deleteDatabaseConnection(id) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        // Check if this is the active connection
        const result = await this.pool.query('SELECT id FROM database_connections WHERE id = $1 AND is_active = true', [id]);
        if (result.rows.length > 0) {
            throw new Error('Cannot delete the active database connection. Please switch to another database first.');
        }
        
        await this.pool.query('DELETE FROM database_connections WHERE id = $1', [id]);
        console.log(`✅ CoreDB Microservice: Database connection ${id} deleted`);
    }
    
    async setActiveDatabaseConnection(id) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        // Use transaction to ensure atomicity
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            
            // Deactivate all connections
            await client.query('UPDATE database_connections SET is_active = false');
            
            // Activate the specified connection
            await client.query('UPDATE database_connections SET is_active = true WHERE id = $1', [id]);
            
            await client.query('COMMIT');
            console.log(`✅ CoreDB Microservice: Database connection ${id} set as active`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Emergency methods for clearing corrupted connections
    async clearAllDatabaseConnections() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        await this.pool.query('DELETE FROM database_connections');
        await this.pool.query(`UPDATE system_config SET value = NULL WHERE key = 'active_database_connection'`);
        console.log('✅ EMERGENCY: All database connections cleared');
    }
    
    async getConnectionsStatus() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }
        
        const result = await this.pool.query('SELECT COUNT(*) as connection_count FROM database_connections');
        return result.rows[0];
    }

    /**
     * Close database connection
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('🔧 CoreDB Microservice: PostgreSQL connection pool closed');
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
        const tables = ['admin_users', 'database_connections', 'storage_providers', 'system_config'];
        for (const table of tables) {
            const result = await this.pool.query(`SELECT COUNT(*) as count FROM ${table}`);
            stats[table] = result.rows[0].count;
        }
        
        return stats;
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
