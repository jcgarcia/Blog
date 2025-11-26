import { Client } from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

console.log('🔍 Testing Database Connection');
console.log('===============================');

console.log('Configuration:');
console.log(`Host: ${process.env.PGHOST}`);
console.log(`Port: ${process.env.PGPORT}`);
console.log(`User: ${process.env.PGUSER}`);
console.log(`Database: ${process.env.PGDATABASE}`);
console.log(`SSL Mode: ${process.env.PGSSLMODE}`);
console.log('');

const client = new Client({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
});

async function testConnection() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Database connection successful!');
    
    // Test query to check if posts table exists
    const result = await client.query('SELECT COUNT(*) FROM posts');
    console.log(`✅ Posts table accessible. Found ${result.rows[0].count} posts.`);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('');
      console.log('💡 This error usually means:');
      console.log('   - The database host/port is incorrect');
      console.log('   - The database is not accessible from this network');
      console.log('   - Firewall is blocking the connection');
    } else if (error.code === 'ENOTFOUND') {
      console.log('');
      console.log('💡 This error usually means:');
      console.log('   - The database host name is incorrect');
      console.log('   - DNS resolution failed');
    }
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignore close errors
    }
  }
}

testConnection();
