#!/usr/bin/env node

// Test script to verify PostgreSQL configuration system
import SystemConfigManager from './api/utils/systemConfig.js';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

console.log(chalk.blue('🐘 PostgreSQL Configuration System Test'));
console.log('=====================================');

// Display connection details
console.log(chalk.yellow('\n📋 Connection Details:'));
console.log(chalk.gray(`   Host: ${process.env.DB_HOST || 'localhost'}`));
console.log(chalk.gray(`   Port: ${process.env.DB_PORT || '5432'}`));
console.log(chalk.gray(`   Database: ${process.env.DB_NAME || 'blog'}`));
console.log(chalk.gray(`   User: ${process.env.DB_USER || 'postgres'}`));

const config = new SystemConfigManager();

async function runTests() {
  try {
    // Test 1: Database connection
    console.log(chalk.yellow('\n📡 Testing database connection...'));
    const connectionTest = await config.testConnection();
    
    if (connectionTest.success) {
      console.log(chalk.green('✅ Database connection successful'));
      console.log(chalk.gray(`   PostgreSQL Version: ${connectionTest.data.pg_version}`));
      console.log(chalk.gray(`   Current Time: ${connectionTest.data.current_time}`));
    } else {
      console.log(chalk.red('❌ Database connection failed'));
      console.log(chalk.red(`   Error: ${connectionTest.error}`));
      return false;
    }

    // Test 2: Get system stats
    console.log(chalk.yellow('\n📊 Getting system statistics...'));
    const stats = await config.getStats();
    console.log(chalk.green('✅ System stats retrieved'));
    console.log(chalk.gray(`   Configurations: ${stats.configurations}`));
    console.log(chalk.gray(`   API Keys: ${stats.apiKeys}`));
    console.log(chalk.gray(`   Audit Entries: ${stats.auditEntries}`));

    // Test 3: Test configuration retrieval
    console.log(chalk.yellow('\n⚙️  Testing configuration retrieval...'));
    const apiUrl = await config.getConfig('blog.api_url');
    if (apiUrl) {
      console.log(chalk.green('✅ Configuration retrieval successful'));
      console.log(chalk.gray(`   blog.api_url: ${apiUrl}`));
    } else {
      console.log(chalk.yellow('⚠️  No configuration found (expected on first run)'));
    }

    // Test 4: Test API key retrieval
    console.log(chalk.yellow('\n🔑 Testing API key retrieval...'));
    const apiKey = await config.getApiKey('blog_publish');
    if (apiKey && apiKey !== 'placeholder-key-will-be-updated') {
      console.log(chalk.green('✅ API key retrieval successful'));
      console.log(chalk.gray(`   Key length: ${apiKey.length} characters`));
    } else {
      console.log(chalk.yellow('⚠️  API key not configured (run setup script first)'));
    }

    // Test 5: Test configuration setting
    console.log(chalk.yellow('\n💾 Testing configuration setting...'));
    const testKey = 'test.timestamp';
    const testValue = new Date().toISOString();
    const setResult = await config.setConfig(testKey, testValue, 'string', 'Test configuration entry');
    
    if (setResult.success) {
      console.log(chalk.green('✅ Configuration setting successful'));
      
      // Verify we can retrieve it
      const retrievedValue = await config.getConfig(testKey);
      if (retrievedValue === testValue) {
        console.log(chalk.green('✅ Configuration retrieval verification successful'));
      } else {
        console.log(chalk.red('❌ Configuration retrieval verification failed'));
      }
    } else {
      console.log(chalk.red('❌ Configuration setting failed'));
      console.log(chalk.red(`   Error: ${setResult.error}`));
    }

    // Test 6: List all configurations
    console.log(chalk.yellow('\n📋 Testing configuration listing...'));
    const allConfigs = await config.getAllConfigs();
    console.log(chalk.green(`✅ Retrieved ${allConfigs.length} configurations`));
    
    if (allConfigs.length > 0) {
      console.log(chalk.gray('   Sample configurations:'));
      allConfigs.slice(0, 3).forEach(cfg => {
        console.log(chalk.gray(`     - ${cfg.key}: ${cfg.value} (${cfg.type})`));
      });
    }

    console.log(chalk.green('\n🎉 All tests completed successfully!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(chalk.white('1. Run the setup script: ./database/setup-postgresql.sh'));
    console.log(chalk.white('2. Configure your API keys: node tools/system-config.js api-key:set <service> <key>'));
    console.log(chalk.white('3. Update your application settings: node tools/system-config.js config:set <key> <value>'));
    
    return true;

  } catch (error) {
    console.log(chalk.red('\n❌ Test failed with error:'));
    console.log(chalk.red(error.message));
    console.log(chalk.red(error.stack));
    return false;
  } finally {
    await config.close();
  }
}

// Run the tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
