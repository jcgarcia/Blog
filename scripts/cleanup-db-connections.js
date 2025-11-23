#!/usr/bin/env node
import { getDbPool, closeDbPool } from './api/db.js';

async function cleanupConnections() {
  console.log('🧹 Starting database connection cleanup...');
  
  try {
    const pool = getDbPool();
    
    // Get current connection stats
    console.log(`📊 Current Pool Stats:`);
    console.log(`   Total connections: ${pool.totalCount}`);
    console.log(`   Idle connections: ${pool.idleCount}`);
    console.log(`   Waiting requests: ${pool.waitingCount}`);
    
    // Close all connections
    console.log('\n🔌 Closing database pool...');
    await closeDbPool();
    
    console.log('✅ Database connections cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

cleanupConnections();
