import CoreDB from '../services/CoreDB.js';

/**
 * Test script for CoreDB functionality
 */
async function testCoreDB() {
    console.log('🧪 Testing CoreDB...\n');

    const coreDB = new CoreDB();

    try {
        // Initialize CoreDB
        console.log('1. Initializing CoreDB...');
        await coreDB.initialize();
        
        // Test configuration
        console.log('\n2. Testing configuration...');
        const blogTitle = await coreDB.getConfig('blog_title');
        console.log(`Blog title: ${blogTitle}`);
        
        await coreDB.setConfig('test_key', 'test_value', 'testing', 'Test configuration');
        const testValue = await coreDB.getConfig('test_key');
        console.log(`Test value: ${testValue}`);
        
        // Test admin authentication
        console.log('\n3. Testing admin authentication...');
        const validAuth = await coreDB.authenticateAdmin('admin', 'admin123');
        console.log('Valid auth result:', validAuth);
        
        const invalidAuth = await coreDB.authenticateAdmin('admin', 'wrong');
        console.log('Invalid auth result:', invalidAuth);
        
        // Test external database configuration
        console.log('\n4. Testing external database configuration...');
        await coreDB.addExternalDatabase({
            name: 'test_db',
            type: 'postgresql',
            host: 'localhost',
            port: 5432,
            database_name: 'test',
            username: 'testuser',
            password: 'testpass',
            active: true
        });
        
        const activeDB = await coreDB.getActiveDatabase();
        console.log('Active database:', activeDB);
        
        // Test storage provider configuration
        console.log('\n5. Testing storage provider configuration...');
        await coreDB.addStorageProvider({
            name: 'test_s3',
            type: 'aws_s3',
            config: {
                region: 'us-east-1',
                bucket: 'test-bucket'
            },
            active: true
        });
        
        const activeStorage = await coreDB.getActiveStorageProvider();
        console.log('Active storage:', activeStorage);
        
        // Test statistics
        console.log('\n6. Testing statistics...');
        const stats = await coreDB.getStats();
        console.log('Database stats:', stats);
        
        // Get all configuration
        console.log('\n7. All configuration:');
        const allConfig = await coreDB.getAllConfig();
        allConfig.forEach(config => {
            console.log(`  ${config.key} = ${config.value} (${config.category})`);
        });
        
        console.log('\n✅ CoreDB test completed successfully!');
        
    } catch (error) {
        console.error('❌ CoreDB test failed:', error);
    } finally {
        await coreDB.close();
    }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testCoreDB();
}

export default testCoreDB;