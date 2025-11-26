#!/usr/bin/env node

import { getDbPool } from '../api/db.js';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

async function checkDatabaseConnection() {
  console.log(`${colors.blue}🔍 Checking Database Connection Status${colors.reset}`);
  console.log('================================================');
  
  // Display current environment variables (without passwords)
  console.log(`${colors.bright}Environment Configuration:${colors.reset}`);
  console.log(`PGHOST: ${process.env.PGHOST || 'NOT SET'}`);
  console.log(`PGPORT: ${process.env.PGPORT || 'NOT SET'}`);
  console.log(`PGDATABASE: ${process.env.PGDATABASE || 'NOT SET'}`);
  console.log(`PGUSER: ${process.env.PGUSER || 'NOT SET'}`);
  console.log(`PGPASSWORD: ${process.env.PGPASSWORD ? 'SET' : 'NOT SET'}`);
  console.log(`PGSSLMODE: ${process.env.PGSSLMODE || 'NOT SET'}`);
  console.log('');

  try {
    const pool = getDbPool();
    
    // Test basic connection
    console.log(`${colors.yellow}⏳ Testing database connection...${colors.reset}`);
    const client = await pool.connect();
    
    // Test basic query
    const result = await client.query('SELECT version(), current_database(), current_user, now() as current_time');
    const info = result.rows[0];
    
    console.log(`${colors.green}✅ Database connection successful!${colors.reset}`);
    console.log('');
    console.log(`${colors.bright}Database Information:${colors.reset}`);
    console.log(`Version: ${info.version}`);
    console.log(`Database: ${info.current_database}`);
    console.log(`User: ${info.current_user}`);
    console.log(`Current Time: ${info.current_time}`);
    console.log('');
    
    // Check for critical tables
    console.log(`${colors.yellow}⏳ Checking critical tables...${colors.reset}`);
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const requiredTables = ['users', 'posts', 'settings', 'categories'];
    const existingTables = tables.rows.map(row => row.table_name);
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length === 0) {
      console.log(`${colors.green}✅ All critical tables exist${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ Missing tables: ${missingTables.join(', ')}${colors.reset}`);
    }
    
    console.log(`${colors.blue}📊 Existing tables (${existingTables.length}):${colors.reset}`);
    existingTables.forEach(table => console.log(`   - ${table}`));
    console.log('');
    
    // Test settings table specifically (since social links are failing)
    if (existingTables.includes('settings')) {
      console.log(`${colors.yellow}⏳ Testing settings table...${colors.reset}`);
      const settingsCount = await client.query('SELECT COUNT(*) as count FROM settings');
      const socialSettings = await client.query(`
        SELECT key, value 
        FROM settings 
        WHERE key LIKE 'social_%' 
        ORDER BY key
      `);
      
      console.log(`${colors.green}✅ Settings table accessible${colors.reset}`);
      console.log(`Settings count: ${settingsCount.rows[0].count}`);
      console.log(`Social settings: ${socialSettings.rows.length}`);
      
      if (socialSettings.rows.length > 0) {
        console.log('Social settings found:');
        socialSettings.rows.forEach(setting => {
          console.log(`   ${setting.key}: ${setting.value || '(empty)'}`);
        });
      }
    }
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error(`${colors.red}❌ Database connection failed:${colors.reset}`);
    console.error(`Error: ${error.message}`);
    console.error('');
    
    if (error.code) {
      console.error(`Error Code: ${error.code}`);
    }
    
    console.log(`${colors.yellow}🔧 Troubleshooting Steps:${colors.reset}`);
    console.log('1. Verify environment variables are set correctly');
    console.log('2. Check if database server is running and accessible');
    console.log('3. Verify SSL/TLS configuration');
    console.log('4. Check firewall and network connectivity');
    console.log('5. Verify database credentials are correct');
    
    process.exit(1);
  }
}

// Production environment check
async function checkProductionEnvironment() {
  console.log(`${colors.blue}🚀 Production Environment Check${colors.reset}`);
  console.log('==========================================');
  
  // Check if we can reach the production API
  try {
    const response = await fetch('https://bapi.ingasti.com/health');
    if (response.ok) {
      const health = await response.json();
      console.log(`${colors.green}✅ Production API is responding${colors.reset}`);
      console.log(`Status: ${health.status}`);
      console.log(`Uptime: ${Math.floor(health.uptime)} seconds`);
    } else {
      console.log(`${colors.red}❌ Production API returned error: ${response.status}${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}❌ Cannot reach production API: ${error.message}${colors.reset}`);
  }
  
  // Check database health endpoint
  try {
    const response = await fetch('https://bapi.ingasti.com/health/db');
    if (response.ok) {
      const dbHealth = await response.json();
      console.log(`${colors.green}✅ Production database health check passed${colors.reset}`);
      console.log(`Database: ${dbHealth.database || 'N/A'}`);
      console.log(`Connected: ${dbHealth.connected || 'N/A'}`);
    } else {
      console.log(`${colors.red}❌ Production database health check failed: ${response.status}${colors.reset}`);
      const errorText = await response.text();
      console.log(`Error details: ${errorText}`);
    }
  } catch (error) {
    console.log(`${colors.red}❌ Production database health check error: ${error.message}${colors.reset}`);
  }
  
  // Test the failing social endpoints
  try {
    const response = await fetch('https://bapi.ingasti.com/api/settings/social');
    if (response.ok) {
      const socialLinks = await response.json();
      console.log(`${colors.green}✅ Social links endpoint working${colors.reset}`);
      console.log('Social links:', socialLinks);
    } else {
      console.log(`${colors.red}❌ Social links endpoint failed: ${response.status}${colors.reset}`);
      const errorText = await response.text();
      console.log(`Error details: ${errorText}`);
    }
  } catch (error) {
    console.log(`${colors.red}❌ Social links endpoint error: ${error.message}${colors.reset}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--production') || args.includes('-p')) {
    await checkProductionEnvironment();
  } else {
    await checkDatabaseConnection();
  }
  
  console.log('');
  console.log(`${colors.blue}🔧 Next Steps:${colors.reset}`);
  console.log('1. If local DB works but production fails, update production environment variables');
  console.log('2. Make sure the production deployment uses PostgreSQL configuration');
  console.log('3. Restart the production application after updating configuration');
  console.log('4. Run: node check-production-db.js --production (to test remote endpoints)');
}

main().catch(console.error);