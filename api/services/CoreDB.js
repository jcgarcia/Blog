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
            host: process.env.COREDB_HOST || 'blog-postgres-service',
            port: process.env.COREDB_PORT || 5432,
            database: process.env.COREDB_DATABASE || 'coredb',
            user: process.env.COREDB_USER || 'blogadmin',
            password: process.env.POSTGRES_PASSWORD,
            ssl: false,
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
        try {
            this.pool = new Pool({
            host: process.env.COREDB_HOST || 'blog-postgres-service',
            port: process.env.COREDB_PORT || 5432,
            database: process.env.COREDB_DATABASE || 'coredb',
            user: process.env.PGUSER || 'dbcore_usr_2025',
            password: process.env.PGPASSWORD || 'DbSecure2025#XpL3vN7wE5xT6gH4uY1zC0',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
            console.log(`🔧 CoreDB: PostgreSQL pool created for ${this.connectionConfig.host}:${this.connectionConfig.port}/${this.connectionConfig.database}`);

            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            // Create schema and load production data
            await this.createSchema();
            await this.loadProductionData();
            
            this.initialized = true;
            console.log('✅ CoreDB: Initialized successfully with production data');

        } catch (error) {
            console.error('❌ CoreDB: Initialization failed:', error);
            throw error;
        }
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
                value JSONB,
                description TEXT,
                is_encrypted BOOLEAN DEFAULT false,
                type VARCHAR(50) DEFAULT 'string',
                group_name VARCHAR(100) DEFAULT 'general',
                is_public BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Database connections for DataDB configuration
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

            -- Storage providers configuration
            CREATE TABLE IF NOT EXISTS storage_providers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                config_encrypted TEXT NOT NULL,
                active BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
            CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
            CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);
            CREATE INDEX IF NOT EXISTS idx_system_config_group ON system_config(group_name);
            CREATE INDEX IF NOT EXISTS idx_database_connections_active ON database_connections(is_active);
            CREATE INDEX IF NOT EXISTS idx_storage_providers_active ON storage_providers(active);
        `;

        await this.pool.query(schema);
        console.log('✅ CoreDB: Schema created successfully');
    }

    async loadProductionData() {
        // Load admin users from backup (users with admin/super_admin roles)
        const adminUsers = [
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
            },
            {
                username: 'coreadmin',
                email: 'coreadmin@coredb.local',
                password_hash: '$argon2id$v=19$m=65536,t=3,p=4$CZKqNvOgAfXV5aEKr3fzAA$gDvtpI1rNjRFpXDCKxpS5EIJM2Z1tIGBSVVoHyHzZME',
                role: 'admin'
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
            { key: 'blog_title', value: '"Guilt & Pleasure Bedtime"', group_name: 'general', is_public: true },
            { key: 'blog_description', value: '"A personal blog about life experiences"', group_name: 'general', is_public: true },
            { key: 'site_title', value: '"Bedtime Stories Blog"', group_name: 'general', is_public: true },
            { key: 'site_url', value: '"https://bedtime.ingasti.com"', group_name: 'general', is_public: true },
            { key: 'site_description', value: '"A cozy corner for bedtime stories and peaceful tales"', group_name: 'general', is_public: true },
            { key: 'api_url', value: '"https://bapi.ingasti.com"', group_name: 'general', is_public: true },
            { key: 'oauth_frontend_url', value: '"https://bedtime.ingasti.com"', group_name: 'oauth', is_public: false },
            { key: 'media_storage_type', value: '"aws"', group_name: 'media', is_public: false },
            { key: 'media_storage_s3_bucket', value: '"bedtime-blog-media"', group_name: 'media', is_public: false },
            { key: 'aws_config', value: '{"region": "eu-west-2", "roleArn": "arn:aws:iam::007041844937:role/BedtimeBlogMediaRole", "accountId": "007041844937", "authMethod": "oidc", "bucketName": "bedtimeblog-medialibrary", "oidcSubject": "system:serviceaccount:blog:media-access-sa", "oidcAudience": "https://oidc.ingasti.com", "oidcIssuerUrl": "https://oidc.ingasti.com"}', group_name: 'aws', is_public: false },
            { key: 'smtp_host', value: '"smtp.gmail.com"', group_name: 'email', is_public: false },
            { key: 'smtp_port', value: '"587"', group_name: 'email', is_public: false },
            { key: 'smtp_user', value: '"smtp@ingasti.com"', group_name: 'email', is_public: false },
            { key: 'smtp_from', value: '"blog@ingasti.com"', group_name: 'email', is_public: false },
            { key: 'contact_email', value: '"blog@ingasti.com"', group_name: 'email', is_public: false },
            { key: 'system.version', value: '"v1.0.0"', group_name: 'system', is_public: false },
            { key: 'system.environment', value: '"production"', group_name: 'system', is_public: false }
        ];

        for (const config of systemConfig) {
            await this.pool.query(`
                INSERT INTO system_config (key, value, group_name, is_public, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                group_name = EXCLUDED.group_name,
                is_public = EXCLUDED.is_public,
                updated_at = NOW()
            `, [config.key, config.value, config.group_name, config.is_public]);
        }

        // Load default DataDB connection
        const defaultPassword = this.encrypt('DbSecure2025#XpL3vN7wE5xT6gH4uY1zC0');
        await this.pool.query(`
            INSERT INTO database_connections (name, type, host, port, database_name, username, password_encrypted, ssl_mode, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            ON CONFLICT DO NOTHING
        `, ['Production Blog Database', 'postgresql', 'blog-postgres-service', 5432, 'blog', 'blogadmin', defaultPassword, 'prefer', true]);

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
            INSERT INTO storage_providers (name, type, config_encrypted, active, created_at, updated_at)
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
            'SELECT value FROM system_config WHERE key = $1',
            [key]
        );

        return result.rows.length > 0 ? result.rows[0].value : null;
    }

    async setConfig(key, value, groupName = 'general', isPublic = false) {
        if (!this.initialized) {
            throw new Error('CoreDB not initialized');
        }

        await this.pool.query(`
            INSERT INTO system_config (key, value, group_name, is_public, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (key) DO UPDATE SET
            value = EXCLUDED.value,
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
            const config = result.rows[0];
            config.password = this.decrypt(config.password_encrypted);
            delete config.password_encrypted;
            return config;
        }

        return null;
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
