#!/usr/bin/env node
// Quick database connection test for production
import { getDbPool } from './api/db.js';

async function testConnection() {
  console.log('🔍 Testing production database connection...');
  
  try {
    const pool = getDbPool();
    const result = await pool.query('SELECT 1 as test');
    console.log('✅ Database connection successful!');
    console.log('📊 Test result:', result.rows[0]);
    
    // Test actual posts query
    const postsResult = await pool.query('SELECT id, title FROM posts LIMIT 3');
    console.log('📝 Sample posts:', postsResult.rows);
    
    await pool.end();
    console.log('✅ Connection test completed successfully');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Host:', process.env.PGHOST);
    console.error('Port:', process.env.PGPORT);
    console.error('Database:', process.env.PGDATABASE);
    console.error('User:', process.env.PGUSER);
    console.error('SSL Mode:', process.env.PGSSLMODE);
  }
  
  process.exit(0);
}

testConnection();
