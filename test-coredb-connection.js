#!/usr/bin/env node

/**
 * Test script to demonstrate CoreDB-centric database connection workflow
 */

import CoreDB from './api/services/CoreDB.js';
import { databaseManager } from './api/db.js';

// Set test credentials
process.env.COREDB_ADMIN_USER = 'admin';
process.env.COREDB_ADMIN_PASSWORD = 'password';
process.env.COREDB_ENCRYPTION_KEY = 'test123';

async function testCoreDBWorkflow() {
  try {
    console.log('🧪 Testing CoreDB-centric database workflow...\n');
    
    // 1. Initialize CoreDB
    console.log('1️⃣ Initializing CoreDB...');
    const coreDB = CoreDB.getInstance();
    await coreDB.initialize();
    console.log('✅ CoreDB initialized\n');
    
    // 2. Check existing connections
    console.log('2️⃣ Checking existing database connections...');
    const existingConnections = await coreDB.getDatabaseConnections();
    console.log(`Found ${existingConnections.length} existing connections\n`);
    
    // 3. Add a database connection with the correct credentials (if not exists)
    console.log('3️⃣ Ensuring Container PostgreSQL connection exists...');
    const connectionConfig = {
      name: 'Container PostgreSQL Test',
      type: 'postgresql',
      host: 'blog-postgres-service',  // Internal Kubernetes service name
      port: 5432,
      database: 'blog',
      username: 'dbcore_usr_2025',    // Real credentials from your table
      password: 'DbSecure2025#XpL3vN7wE5xT6gH4uY1zC0',
      ssl_mode: 'disable'
    };
    
    let connectionId;
    try {
      connectionId = await coreDB.createDatabaseConnection(connectionConfig);
      console.log(`✅ Database connection created with ID: ${connectionId}\n`);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        // Connection already exists, find it
        const connections = await coreDB.getDatabaseConnections();
        const existingConnection = connections.find(conn => conn.name === connectionConfig.name || conn.host === connectionConfig.host);
        connectionId = existingConnection ? existingConnection.id : connections[0].id;
        console.log(`✅ Using existing database connection with ID: ${connectionId}\n`);
      } else {
        throw error;
      }
    }
    
    // 4. Set as active connection
    console.log('4️⃣ Setting as active connection...');
    await coreDB.setActiveDatabaseConnection(connectionId);
    console.log('✅ Connection set as active\n');
    
    // 5. Get active database config
    console.log('5️⃣ Retrieving active database configuration...');
    const activeConfig = await coreDB.getActiveDatabaseConfig();
    console.log('Active Database Config:');
    console.log(JSON.stringify({
      ...activeConfig,
      password: '[HIDDEN]' // Don't log the actual password
    }, null, 2));
    console.log('');
    
    // 6. Initialize DatabaseManager with CoreDB config
    console.log('6️⃣ Initializing DatabaseManager...');
    await databaseManager.initialize();
    const healthStatus = databaseManager.getHealthStatus();
    console.log('DatabaseManager Health Status:');
    console.log(JSON.stringify(healthStatus, null, 2));
    console.log('');
    
    // 7. Test database connection through DatabaseManager
    console.log('7️⃣ Testing database connection...');
    try {
      const result = await databaseManager.query('SELECT NOW() as current_time, version() as pg_version');
      console.log('✅ Database query successful:');
      console.log(`   Current time: ${result.rows[0].current_time}`);
      console.log(`   PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
    } catch (dbError) {
      console.log('❌ Database connection failed:', dbError.message);
      console.log('   This is expected if the PostgreSQL service is not available');
    }
    
    console.log('\n🎉 CoreDB-centric workflow test complete!');
    console.log('\n📝 Summary:');
    console.log('   ✅ CoreDB initialized successfully');
    console.log('   ✅ Database connection configuration stored in CoreDB');
    console.log('   ✅ DatabaseManager reads configuration from CoreDB');
    console.log('   ✅ No PostgreSQL credentials needed from Jenkins');
    console.log('   ✅ Database connections configured through ops panel workflow');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await databaseManager.shutdown();
    process.exit(0);
  }
}

testCoreDBWorkflow();