import { Client } from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

console.log('🔧 Fixing AWS Configuration Data');
console.log('=================================');

const client = new Client({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
});

async function fixAwsConfig() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Database connection successful!');
    console.log('');
    
    // Get the current aws_config
    const result = await client.query("SELECT value FROM settings WHERE key = 'aws_config'");
    
    if (result.rows.length === 0) {
      console.log('❌ No aws_config found in database');
      return;
    }
    
    const currentConfig = JSON.parse(result.rows[0].value);
    console.log('📋 Current config:', currentConfig);
    
    // Fix the configuration
    const fixedConfig = {
      bucketName: (currentConfig.bucket || currentConfig.bucketName || '').trim(), // Remove trailing spaces and use correct field name
      region: currentConfig.region,
      roleArn: currentConfig.roleArn,
      externalId: currentConfig.externalId,
      updatedAt: new Date().toISOString(),
      updatedBy: currentConfig.updatedBy || 1
    };
    
    console.log('');
    console.log('🔧 Fixed config:', fixedConfig);
    
    // Update the configuration
    await client.query(
      "UPDATE settings SET value = $1 WHERE key = 'aws_config'",
      [JSON.stringify(fixedConfig)]
    );
    
    console.log('');
    console.log('✅ AWS configuration fixed successfully!');
    console.log('');
    console.log('Changes made:');
    console.log(`- Renamed "bucket" field to "bucketName"`);
    console.log(`- Trimmed bucket name: "${currentConfig.bucket}" → "${fixedConfig.bucketName}"`);
    console.log(`- Updated timestamp to: ${fixedConfig.updatedAt}`);
    
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

fixAwsConfig();
