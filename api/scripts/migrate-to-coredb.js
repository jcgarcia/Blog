import CoreDB from '../services/CoreDB.js';

/**
 * Migration script to move current AWS configuration to CoreDB
 * This will store AWS RDS and S3 OIDC configuration in CoreDB
 */
async function migrateToCore() {
    console.log('🔄 Starting migration to CoreDB...\n');

    const coreDB = new CoreDB();

    try {
        // Initialize CoreDB
        await coreDB.initialize();
        
        console.log('📊 Current system configuration:');
        console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
        console.log(`DB_HOST: ${process.env.DB_HOST || 'Not set'}`);
        console.log(`DB_USER: ${process.env.DB_USER || 'Not set'}`);
        console.log(`DB_PASSWORD: ${process.env.DB_PASSWORD ? 'Set' : 'Not set'}`);
        
        // 1. Migrate AWS RDS configuration
        console.log('\n🗄️  Migrating AWS RDS configuration...');
        
        const dbConfig = {
            name: 'aws_rds_production',
            type: 'postgresql',
            host: process.env.DB_HOST || 'bedtime-blog-db.c78swcmyuzum.eu-west-2.rds.amazonaws.com',
            port: 5432,
            database_name: 'blog',
            username: process.env.DB_USER || 'blogadmin',
            password: process.env.DB_PASSWORD || 'rF4mZHs5L)hT*9)c',
            ssl_mode: 'require',
            active: true
        };
        
        await coreDB.addExternalDatabase(dbConfig);
        const activeDB = await coreDB.getActiveDatabase();
        console.log(`✅ AWS RDS configuration stored: ${activeDB.host}/${activeDB.database_name}`);
        
        // 2. Migrate AWS S3 OIDC configuration
        console.log('\n📁 Migrating AWS S3 OIDC configuration...');
        
        const storageConfig = {
            name: 'aws_s3_production',
            type: 'aws_s3',
            config: {
                region: 'eu-west-2',
                bucket: 'bedtime-blog-media',
                use_oidc: true,
                oidc_role_arn: process.env.AWS_ROLE_ARN || '',
                // These will be used in Kubernetes environment
                kubernetes_service_account: 'media-access-sa',
                kubernetes_namespace: 'blog'
            },
            active: true
        };
        
        await coreDB.addStorageProvider(storageConfig);
        const activeStorage = await coreDB.getActiveStorageProvider();
        console.log(`✅ AWS S3 configuration stored: ${activeStorage.config.bucket} in ${activeStorage.config.region}`);
        
        // 3. Update core configuration with production values
        console.log('\n⚙️  Updating core configuration...');
        
        await coreDB.setConfig('blog_title', 'Bedtime Stories', 'general', 'Production blog title');
        await coreDB.setConfig('blog_description', 'A magical collection of bedtime stories', 'general', 'Production blog description');
        await coreDB.setConfig('cors_origin', 'https://bedtime.ingasti.com', 'security', 'Production CORS origin');
        await coreDB.setConfig('api_base_url', 'https://bapi.ingasti.com', 'general', 'Production API base URL');
        await coreDB.setConfig('frontend_url', 'https://bedtime.ingasti.com', 'general', 'Production frontend URL');
        await coreDB.setConfig('admin_email', 'admin@bedtime.ingasti.com', 'general', 'Admin contact email');
        
        console.log('✅ Core configuration updated');
        
        // 4. Create production admin user (replace default)
        console.log('\n👤 Setting up production admin user...');
        
        // Note: In production, you should set a secure password
        // Check if production admin already exists (using PostgreSQL syntax)
        const result = await coreDB.pool.query(
            'SELECT id FROM admin_users WHERE username = $1', 
            ['sysop_3sdmzl']
        );
        const productionAdminExists = result.rows[0];
        
        if (!productionAdminExists) {
            const argon2 = await import('argon2');
            const productionPasswordHash = await argon2.default.hash('NewSecretPa55w0rd');
            
            await coreDB.pool.query(
                `INSERT INTO admin_users (username, password_hash, email, role) 
                 VALUES ($1, $2, $3, $4)`,
                ['sysop_3sdmzl', productionPasswordHash, 'sysop@bedtime.ingasti.com', 'admin']
            );
            
            console.log('✅ Production admin user created: sysop_3sdmzl');
        } else {
            console.log('ℹ️  Production admin user already exists');
        }
        
        // 5. Display migration summary
        console.log('\n📋 Migration Summary:');
        const stats = await coreDB.getStats();
        console.log(`Database: PostgreSQL (${coreDB.connectionConfig.host}:${coreDB.connectionConfig.port}/${coreDB.connectionConfig.database})`);
        console.log(`Database size: ${stats.database_size || 'Not available'}`);
        console.log(`Admin users: ${stats.admin_users.count}`);
        console.log(`External databases: ${stats.external_databases.count}`);
        console.log(`Storage providers: ${stats.storage_providers.count}`);
        console.log(`Configuration entries: ${stats.core_config.count}`);
        
        // 6. Verify encryption is working
        console.log('\n🔐 Verifying encryption...');
        const testDB = await coreDB.getActiveDatabase();
        const testStorage = await coreDB.getActiveStorageProvider();
        console.log('✅ Database credentials decrypted successfully');
        console.log('✅ Storage configuration decrypted successfully');
        
        // 7. Generate environment variables for container
        console.log('\n🌍 Environment variables for container deployment:');
        console.log('COREDB_HOST=blog-postgres-service');
        console.log('COREDB_DATABASE=coredb');
        console.log(`COREDB_ENCRYPTION_KEY=${coreDB.encryptionKey}`);
        console.log('NODE_ENV=production');
        
        console.log('\n✅ Migration to CoreDB completed successfully!');
        console.log('🔄 Next steps:');
        console.log('1. Update Kubernetes deployment to use CoreDB');
        console.log('2. Remove database environment variables from secrets');
        console.log('3. Add CORE_DB_ENCRYPTION_KEY to Kubernetes secrets');
        console.log('4. Test deployment with CoreDB');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await coreDB.close();
    }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    // Set environment variables for testing
    process.env.DB_HOST = 'bedtime-blog-db.c78swcmyuzum.eu-west-2.rds.amazonaws.com';
    process.env.DB_USER = 'blogadmin';
    process.env.DB_PASSWORD = 'rF4mZHs5L)hT*9)c';
    
    migrateToCore().catch(console.error);
}

export default migrateToCore;