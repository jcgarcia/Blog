import { Client } from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

console.log('🔍 Checking AWS Settings in Database');
console.log('====================================');

const client = new Client({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
});

async function checkAwsSettings() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Database connection successful!');
    console.log('');
    
    // Check for AWS-related settings
    console.log('📋 Checking AWS settings...');
    const result = await client.query("SELECT key, value FROM settings WHERE key LIKE 'aws%' ORDER BY key");
    
    if (result.rows.length === 0) {
      console.log('❌ No AWS settings found in database');
    } else {
      console.log(`✅ Found ${result.rows.length} AWS-related settings:`);
      console.log('');
      
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. Key: ${row.key}`);
        console.log(`   Value: ${row.value}`);
        
        // Try to parse JSON values
        try {
          const parsed = JSON.parse(row.value);
          console.log(`   Parsed JSON:`, parsed);
        } catch (e) {
          console.log(`   (Not JSON format)`);
        }
        console.log('   ---');
      });
    }
    
    // Also check for any bucket-related settings
    console.log('');
    console.log('📋 Checking bucket-related settings...');
    const bucketResult = await client.query("SELECT key, value FROM settings WHERE key LIKE '%bucket%' OR value LIKE '%bucket%' ORDER BY key");
    
    if (bucketResult.rows.length === 0) {
      console.log('❌ No bucket-related settings found');
    } else {
      console.log(`✅ Found ${bucketResult.rows.length} bucket-related settings:`);
      console.log('');
      
      bucketResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. Key: ${row.key}`);
        console.log(`   Value: ${row.value}`);
        console.log('   ---');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignore close errors
    }
  }
}

checkAwsSettings();
