import pkg from 'pg';
const { Pool } = pkg;
import argon2 from 'argon2';
import crypto from 'crypto';

/**
 * CoreDB - PostgreSQL-based configuration and admin database
 * Contains: Admin authentication, system configuration, database connections, storage providers
 * Data source: Extracted from production backup backup-2025-10-20T11-09-18.sql
 */
class CoreDB {
    constructor() {
        if (CoreDB.instance) {
            return CoreDB.instance;
        }

        // PostgreSQL connection to CoreDB database
        this.connectionConfig = {
            host: process.env.PGHOST || process.env.COREDB_HOST || 'blog-postgres-service',
            port: process.env.PGPORT || process.env.COREDB_PORT || 5432,
            database: process.env.PGDATABASE || process.env.COREDB_DATABASE || 'coredb',
            user: process.env.PGUSER || process.env.COREDB_USER || 'CoreDBConnect',
            password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
            ssl: {
                rejectUnauthorized: false // Accept self-signed certificates
            },
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        this.pool = null;
        this.initialized = false;
        this.encryptionKey = process.env.COREDB_ENCRYPTION_KEY;

        // Validation
        if (!this.encryptionKey) {
            throw new Error('COREDB_ENCRYPTION_KEY environment variable required');
        }
        if (!this.connectionConfig.password) {
            throw new Error('POSTGRES_PASSWORD environment variable required');
        }

        CoreDB.instance = this;
    }

    async initialize() {
        const maxRetries = 10;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                // Use consistent configuration for the actual pool
                const poolConfig = {
                    host: process.env.PGHOST || process.env.COREDB_HOST || 'blog-postgres-service',
                    port: parseInt(process.env.PGPORT || process.env.COREDB_PORT || '5432'),
                    database: process.env.PGDATABASE || process.env.COREDB_DATABASE || 'coredb',
                    user: process.env.PGUSER || 'CoreDBConnect',
                    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD,
                    ssl: {
                        rejectUnauthorized: false // Accept self-signed certificates
                    },
                    max: 20,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 5000,
                };
                
                if (retryCount === 0) {
                    console.log(`🔧 CoreDB: Creating PostgreSQL pool for ${poolConfig.host}:${poolConfig.port}/${poolConfig.database} with user ${poolConfig.user}`);
                }
                
                this.pool = new Pool(poolConfig);
                
                if (retryCount === 0) {
                    console.log(`🔧 CoreDB: PostgreSQL pool created for ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`);
                }

                // Test connection with timeout
                console.log(`🔧 CoreDB: Testing connection (attempt ${retryCount + 1}/${maxRetries})...`);
                const client = await this.pool.connect();
                await client.query('SELECT NOW()');
                client.release();
                console.log('✅ CoreDB: Database connection successful');

                // Create schema and load production data
                await this.createSchema();
                await this.loadProductionData();
                
                this.initialized = true;
                console.log('✅ CoreDB: Initialized successfully with production data');
                return; // Success - exit retry loop

            } catch (error) {
                retryCount++;
                const isConnectionError = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT';
                
                if (retryCount >= maxRetries) {
                    console.error(`❌ CoreDB: Initialization failed after ${maxRetries} attempts:`, error);
                    throw error;
                }
                
                if (isConnectionError) {
                    const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000); // Exponential backoff, max 10s
                    console.log(`⚠️ CoreDB: Connection failed (attempt ${retryCount}/${maxRetries}), retrying in ${delay}ms...`);
                    console.log(`   Error: ${error.message}`);
                    
                    // Clean up failed pool
                    if (this.pool) {
                        await this.pool.end().catch(() => {});
                        this.pool = null;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // Non-connection error, don't retry
                    console.error('❌ CoreDB: Non-connection error, not retrying:', error);
                    throw error;
                }
            }
        }
        
        // If we get here, all retries failed
        throw new Error(`CoreDB initialization failed after ${maxRetries} connection attempts`);
    }

    async createSchema() {
        const schema = `
            -- Admin users table (extracted from backup users table)
            CREATE TABLE IF NOT EXISTS admin_users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role VARCHAR(50) DEFAULT 'admin',
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                last_login TIMESTAMP
            );

            -- System configuration table (extracted from backup settings table)
            CREATE TABLE IF NOT EXISTS system_config (
                id SERIAL PRIMARY KEY,
                key VARCHAR(255) UNIQUE NOT NULL,
                config_value JSONB,
                description TEXT,
                is_encrypted BOOLEAN DEFAULT false,
                config_type VARCHAR(50) DEFAULT 'string',
                group_name VARCHAR(100) DEFAULT 'general',
                is_public BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Database connections configuration
            CREATE TABLE IF NOT EXISTS database_connections (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
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

            -- Storage providers configuration
            CREATE TABLE IF NOT EXISTS storage_providers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                config_encrypted TEXT NOT NULL,
                is_active BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
            CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
            CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);
            CREATE INDEX IF NOT EXISTS idx_system_config_group ON system_config(group_name);
            CREATE INDEX IF NOT EXISTS idx_database_connections_active ON database_connections(is_active);
            CREATE INDEX IF NOT EXISTS idx_storage_providers_active ON storage_providers(is_active);
            
            -- Add unique constraint to database_connections.name if it doesn't exist
            DO $$ 
            BEGIN 
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint 
                    WHERE conrelid = 'database_connections'::regclass 
                    AND conname = 'database_connections_name_key'
                ) THEN
                    -- First remove any duplicate connections with the same name (keep the oldest)
                    DELETE FROM database_connections 
                    WHERE id NOT IN (
                        SELECT MIN(id) FROM database_connections 
                        GROUP BY name
                    );
                    
                    -- Then add the unique constraint
                    ALTER TABLE database_connections ADD CONSTRAINT database_connections_name_key UNIQUE (name);
                END IF;
            END $$;
        `;

        await this.pool.query(schema);
        console.log('✅ CoreDB: Schema created successfully');
    }

    async loadProductionData() {
        // Create admin user from environment variables (Jenkins credentials)
        const adminUsername = process.env.COREDB_ADMIN_USER || 'coreadmin';
        const adminPassword = process.env.COREDB_ADMIN_PASSWORD || 'CoreAdmin2025#Secure';
        const adminPasswordHash = await argon2.hash(adminPassword);
        
        console.log(`🔧 Creating admin user: ${adminUsername}`);
        
        // Load admin users - use environment credentials for primary admin
        const adminUsers = [
            {
                username: adminUsername,
                email: 'admin@bedtime.ingasti.com',
                password_hash: adminPasswordHash,
                role: 'admin'
            },
            {
                username: 'sysop_3sdmzl',
                email: 'sysop@ingasti.com',
                password_hash: '$argon2id$v=19$m=65536,t=3,p=4$alQuWfp5kC3zQsEsdwudwQ$gghE+KPYctcgaaRBc5QFiJ2Nms6MWou6LuhQk/Buu2M',
                role: 'super_admin'
            },
            {
                username: 'jcsa025',
                email: 'jcgarcia@ingasti.com',
                password_hash: '$argon2id$v=19$m=65536,t=3,p=4$X1M1UllPOTVTICGixTh3SQ$w1Pxt96Y6AzRc5WTek0ZVOjTXFNkKGM1jRiSCkHyYhg',
                role: 'super_admin'
            }
        ];

        for (const user of adminUsers) {
            await this.pool.query(`
                INSERT INTO admin_users (username, email, password_hash, role, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, true, NOW(), NOW())
                ON CONFLICT (username) DO UPDATE SET
                email = EXCLUDED.email,
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                updated_at = NOW()
            `, [user.username, user.email, user.password_hash, user.role]);
        }

        // Load system configuration from backup settings
        const systemConfig = [
            // Social media links (from backup settings table)
            { key: 'social_linkedin_url', value: '"https://www.linkedin.com/in/juliocesargarcia/"', group_name: 'social', is_public: true },
            { key: 'social_twitter_url', value: '"https://x.com/yojulito"', group_name: 'social', is_public: true },
            { key: 'social_instagram_url', value: '"https://instagram.com/yojulito"', group_name: 'social', is_public: true },
            { key: 'social_threads_url', value: '"https://threads.net/@yojulito"', group_name: 'social', is_public: true },
            
            // General site configuration
            { key: 'blog_title', value: '"Guilt & Pleasure Bedtime"', group_name: 'general', is_public: true },
            { key: 'blog_description', value: '"A personal blog about life experiences"', group_name: 'general', is_public: true },
            { key: 'site_title', value: '"Bedtime Stories Blog"', group_name: 'general', is_public: true },
            { key: 'site_url', value: '"https://bedtime.ingasti.com"', group_name: 'general', is_public: true },
            { key: 'site_description', value: '"A cozy corner for bedtime stories and peaceful tales"', group_name: 'general', is_public: true },
            { key: 'api_url', value: '"https://bapi.ingasti.com"', group_name: 'general', is_public: true },
            { key: 'posts_per_page', value: '10', group_name: 'content', is_public: true },
            { key: 'allow_comments', value: 'true', group_name: 'content', is_public: true },
            { key: 'comment_moderation', value: 'false', group_name: 'content', is_public: false },
            { key: 'require_approval', value: '"true"', group_name: 'general', is_public: true },
            { key: 'enable_moderation', value: '"true"', group_name: 'general', is_public: true },
            { key: 'enable_auto_save', value: '"true"', group_name: 'general', is_public: true },
            { key: 'auto_save_interval', value: '"30"', group_name: 'general', is_public: true },
            
            // OAuth configuration - Loaded from environment variables (secure)
            { key: 'oauth_frontend_url', value: '"https://bedtime.ingasti.com"', group_name: 'oauth', is_public: false },
            { key: 'oauth_cognito_user_pool_id', value: process.env.COGNITO_USER_POOL_ID ? `"${process.env.COGNITO_USER_POOL_ID}"` : '""', group_name: 'oauth', is_public: false },
            { key: 'oauth_cognito_client_id', value: process.env.COGNITO_CLIENT_ID ? `"${process.env.COGNITO_CLIENT_ID}"` : '""', group_name: 'oauth', is_public: false },
            { key: 'oauth_cognito_client_secret', value: process.env.COGNITO_CLIENT_SECRET ? `"${process.env.COGNITO_CLIENT_SECRET}"` : '""', group_name: 'oauth', is_public: false },
            { key: 'oauth_cognito_region', value: process.env.COGNITO_REGION || '"eu-west-2"', group_name: 'oauth', is_public: false },
            { key: 'oauth_cognito_domain', value: process.env.COGNITO_DOMAIN ? `"${process.env.COGNITO_DOMAIN}"` : '""', group_name: 'oauth', is_public: false },
            
            // Media storage configuration
            { key: 'media_storage_type', value: '"aws"', group_name: 'media', is_public: false },
            { key: 'media_storage_s3_bucket', value: '"bedtime-blog-media"', group_name: 'media', is_public: false },
            { key: 'aws_config', value: '{"region": "eu-west-2", "roleArn": "arn:aws:iam::007041844937:role/BedtimeBlogMediaRole", "accountId": "007041844937", "authMethod": "oidc", "bucketName": "bedtimeblog-medialibrary", "oidcSubject": "system:serviceaccount:blog:media-access-sa", "oidcAudience": "https://oidc.ingasti.com", "oidcIssuerUrl": "https://oidc.ingasti.com"}', group_name: 'aws', is_public: false },
            { key: 'media.max_upload_size', value: '"10485760"', group_name: 'general', is_public: false },
            
            // Email configuration
            { key: 'smtp_host', value: '"smtp.gmail.com"', group_name: 'email', is_public: false },
            { key: 'smtp_port', value: '"587"', group_name: 'email', is_public: false },
            { key: 'smtp_user', value: '"smtp@ingasti.com"', group_name: 'email', is_public: false },
            { key: 'smtp_from', value: '"blog@ingasti.com"', group_name: 'email', is_public: false },
            { key: 'smtp_secure', value: '"false"', group_name: 'email', is_public: false },
            { key: 'contact_email', value: '"blog@ingasti.com"', group_name: 'email', is_public: false },
            { key: 'email_notifications', value: '"true"', group_name: 'email', is_public: false },
            
            // System configuration
            { key: 'system.version', value: '"v1.0.0"', group_name: 'system', is_public: false },
            { key: 'system.environment', value: '"production"', group_name: 'system', is_public: false }
        ];

        for (const config of systemConfig) {
            await this.pool.query(`
                INSERT INTO system_config (key, config_value, group_name, is_public, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                ON CONFLICT (key) DO UPDATE SET
                config_value = EXCLUDED.config_value,
                group_name = EXCLUDED.group_name,
                is_public = EXCLUDED.is_public,
                updated_at = NOW()
            `, [config.key, config.value, config.group_name, config.is_public]);
        }

        // Load default DataDB connection with correct credentials
        const defaultPassword = this.encrypt('zpnTeYwhPiyTCs938hVpG4swN');
        await this.pool.query(`
            INSERT INTO database_connections (name, type, host, port, database_name, username, password_encrypted, ssl_mode, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            ON CONFLICT (name) DO UPDATE SET 
                password_encrypted = EXCLUDED.password_encrypted,
                username = EXCLUDED.username,
                updated_at = NOW()
        `, ['Production Blog Database', 'postgresql', 'blog-postgres-service', 5432, 'blog', 'DataDBConnect', defaultPassword, 'prefer', true]);

        // Load AWS S3 storage provider
        const awsConfig = this.encrypt(JSON.stringify({
            region: 'eu-west-2',
            roleArn: 'arn:aws:iam::007041844937:role/BedtimeBlogMediaRole',
            accountId: '007041844937',
            authMethod: 'oidc',
            bucketName: 'bedtimeblog-medialibrary',
            oidcSubject: 'system:serviceaccount:blog:media-access-sa',
            oidcAudience: 'https://oidc.ingasti.com',
            oidcIssuerUrl: 'https://oidc.ingasti.com'
        }));

        await this.pool.query(`
            INSERT INTO storage_providers (name, type, config_encrypted, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT DO NOTHING
        `, ['AWS S3 Production', 'aws-s3', awsConfig, true]);

        console.log('✅ CoreDB: Production data loaded successfully');
    }

    // Authentication method
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

    // Configuration methods
    async getConfig(key) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const result = await this.pool.query(
            'SELECT config_value FROM system_config WHERE key = $1',
            [key]
        );

        return result.rows.length > 0 ? result.rows[0].config_value : null;
    }

    async setConfig(key, value, groupName = 'general', isPublic = false) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        await this.pool.query(`
            INSERT INTO system_config (key, config_value, group_name, is_public, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (key) DO UPDATE SET
            config_value = EXCLUDED.config_value,
            group_name = EXCLUDED.group_name,
            is_public = EXCLUDED.is_public,
            updated_at = NOW()
        `, [key, value, groupName, isPublic]);
    }

    // Database connection methods
    async getDatabaseConnections() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const result = await this.pool.query(`
            SELECT id, name, type, host, port, database_name as database,
                   username, password_encrypted, ssl_mode, is_active as active, created_at, updated_at
            FROM database_connections
            ORDER BY name
        `);

        // Decrypt passwords for each connection
        const connections = result.rows.map(config => {
            if (config.password_encrypted) {
                config.password = this.decrypt(config.password_encrypted);
            }
            return config;
        });

        return connections;
    }

    async getDatabaseConnectionById(id) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const result = await this.pool.query(`
            SELECT id, name, type, host, port, database_name as database,
                   username, password_encrypted, ssl_mode, is_active as active, created_at, updated_at
            FROM database_connections
            WHERE id = $1
        `, [id]);

        return result.rows.length > 0 ? result.rows[0] : null;
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
            const config = result.rows[0];
            config.password = this.decrypt(config.password_encrypted);
            delete config.password_encrypted;
            return config;
        }

        return null;
    }

    async createDatabaseConnection(connectionData) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const { name, type, host, port, database, username, password, ssl_mode } = connectionData;
        const encrypted_password = this.encrypt(password);

        const result = await this.pool.query(`
            INSERT INTO database_connections (name, type, host, port, database_name, username, password_encrypted, ssl_mode, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
            RETURNING id, name, type, host, port, database_name as database, username, ssl_mode, is_active as active, created_at, updated_at
        `, [name, type, host, port, database, username, encrypted_password, ssl_mode || 'prefer']);

        return result.rows[0];
    }

    async updateDatabaseConnection(id, connectionData) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const { name, type, host, port, database, username, password, ssl_mode } = connectionData;
        let encrypted_password = null;
        
        if (password) {
            encrypted_password = this.encrypt(password);
        }

        let query, params;
        if (encrypted_password) {
            query = `
                UPDATE database_connections 
                SET name = $2, type = $3, host = $4, port = $5, database_name = $6, 
                    username = $7, password_encrypted = $8, ssl_mode = $9, updated_at = NOW()
                WHERE id = $1
                RETURNING id, name, type, host, port, database_name as database, username, ssl_mode, is_active as active, created_at, updated_at
            `;
            params = [id, name, type, host, port, database, username, encrypted_password, ssl_mode || 'prefer'];
        } else {
            query = `
                UPDATE database_connections 
                SET name = $2, type = $3, host = $4, port = $5, database_name = $6, 
                    username = $7, ssl_mode = $8, updated_at = NOW()
                WHERE id = $1
                RETURNING id, name, type, host, port, database_name as database, username, ssl_mode, is_active as active, created_at, updated_at
            `;
            params = [id, name, type, host, port, database, username, ssl_mode || 'prefer'];
        }

        const result = await this.pool.query(query, params);
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    async deleteDatabaseConnection(id) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const result = await this.pool.query(
            'DELETE FROM database_connections WHERE id = $1 RETURNING id',
            [id]
        );

        return result.rows.length > 0;
    }

    async activateDatabaseConnection(id) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        // First deactivate all connections
        await this.pool.query('UPDATE database_connections SET is_active = false');
        
        // Then activate the specified one
        const result = await this.pool.query(
            'UPDATE database_connections SET is_active = true WHERE id = $1 RETURNING id',
            [id]
        );

        return result.rows.length > 0;
    }

    async testDatabaseConnection(connectionData) {
        const { type, host, port, database, username, password, ssl_mode } = connectionData;
        
        if (type !== 'postgresql') {
            throw new Error('Only PostgreSQL connections are supported');
        }

        const testPool = new Pool({
            host,
            port: parseInt(port),
            database,
            user: username,
            password,
            ssl: ssl_mode === 'require' ? { rejectUnauthorized: false } : ssl_mode === 'prefer' ? { rejectUnauthorized: false } : false,
            max: 1,
            connectionTimeoutMillis: 5000,
        });

        try {
            const client = await testPool.connect();
            await client.query('SELECT NOW()');
            client.release();
            await testPool.end();
            
            return { success: true, message: 'Connection successful' };
        } catch (error) {
            await testPool.end().catch(() => {});
            throw new Error(`Connection failed: ${error.message}`);
        }
    }

    // Emergency methods
    async clearAllDatabaseConnections() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        await this.pool.query('DELETE FROM database_connections');
        console.log('✅ CoreDB: All database connections cleared');
    }

    async getConnectionsStatus() {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        const result = await this.pool.query('SELECT COUNT(*) as connection_count FROM database_connections');
        return result.rows[0];
    }

    // Encryption methods
    encrypt(text) {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return iv.toString('hex') + ':' + encrypted;
    }

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

    // Cleanup
    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('🔧 CoreDB: PostgreSQL connection closed');
        }
    }

    // Singleton pattern
    static getInstance() {
        if (!CoreDB.instance) {
            CoreDB.instance = new CoreDB();
        }
        return CoreDB.instance;
    }
}

CoreDB.instance = null;

export default CoreDB;
// Jenkins credentials corrected: postgres-host=blog-postgres-service, postgres-database=coredb
