#!/usr/bin/env node

import SystemConfigManager from '../api/utils/systemConfig.js';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import crypto from 'crypto';

const program = new Command();
const config = new SystemConfigManager();

// Test database connection
program
  .command('test')
  .description('Test database connection')
  .action(async () => {
    try {
      console.log(chalk.blue('🔍 Testing PostgreSQL connection...'));
      const result = await config.testConnection();
      
      if (result.success) {
        console.log(chalk.green('✅ Connection successful!'));
        console.log(chalk.gray('Database time:'), result.data.current_time);
        console.log(chalk.gray('PostgreSQL version:'), result.data.version);
      } else {
        console.log(chalk.red('❌ Connection failed:'), result.error);
        process.exit(1);
      }
      
      await config.close();
    } catch (error) {
      console.error(chalk.red('❌ Test failed:'), error.message);
      process.exit(1);
    }
  });

// Helper function to format table output
function formatTable(data, headers) {
  console.table(data);
}

// Generate secure API key
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Config commands
program
  .command('config:list')
  .description('List all configuration values')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (options) => {
    try {
      const configs = await config.getAllConfigs();
      console.log(chalk.blue('\n📋 System Configuration'));
      console.log('========================');
      formatTable(configs, ['Key', 'Value', 'Type', 'Description']);
      await config.close();
    } catch (error) {
      console.error(chalk.red('❌ Error listing configs:'), error.message);
      process.exit(1);
    }
  });

program
  .command('config:get <key>')
  .description('Get a configuration value')
  .action(async (key) => {
    try {
      const value = await config.getConfig(key);
      console.log(chalk.green(`✅ ${key}:`), value);
      await config.close();
    } catch (error) {
      console.error(chalk.red('❌ Error getting config:'), error.message);
      process.exit(1);
    }
  });

program
  .command('config:set <key> <value>')
  .description('Set a configuration value')
  .option('-d, --description <description>', 'Description of the configuration')
  .option('-c, --category <category>', 'Category', 'general')
  .option('-e, --encrypt', 'Encrypt the value')
  .action(async (key, value, options) => {
    try {
      await config.setConfig(key, value, options.description, options.category, options.encrypt);
      console.log(chalk.green(`✅ Configuration '${key}' set successfully`));
      await config.close();
    } catch (error) {
      console.error(chalk.red('❌ Error setting config:'), error.message);
      process.exit(1);
    }
  });

// API Key commands
program
  .command('apikey:list')
  .description('List all API keys (without values)')
  .option('-s, --service <service>', 'Filter by service')
  .action(async (options) => {
    try {
      const keys = await config.listApiKeys(options.service);
      console.log(chalk.blue('\n🔑 API Keys'));
      console.log('===========');
      formatTable(keys, ['Name', 'Service', 'Environment', 'Active', 'Last Used', 'Usage Count']);
      await config.close();
    } catch (error) {
      console.error(chalk.red('❌ Error listing API keys:'), error.message);
      process.exit(1);
    }
  });

program
  .command('apikey:get <keyName>')
  .description('Get an API key value')
  .action(async (keyName) => {
    try {
      const keyValue = await config.getApiKey(keyName);
      console.log(chalk.green(`✅ API Key '${keyName}':`));
      console.log(chalk.yellow(`🔑 ${keyValue}`));
      console.log(chalk.red('⚠️  Keep this key secure!'));
      await config.close();
    } catch (error) {
      console.error(chalk.red('❌ Error getting API key:'), error.message);
      process.exit(1);
    }
  });

program
  .command('apikey:set <keyName> <keyValue>')
  .description('Set an API key')
  .option('-d, --description <description>', 'Description of the API key')
  .option('-s, --service <service>', 'Service name', 'general')
  .option('-e, --environment <environment>', 'Environment', 'production')
  .option('-x, --expires <expires>', 'Expiration date (YYYY-MM-DD)')
  .action(async (keyName, keyValue, options) => {
    try {
      const expiresAt = options.expires ? new Date(options.expires) : null;
      await config.setApiKey(keyName, keyValue, options.description, options.service, options.environment, expiresAt);
      console.log(chalk.green(`✅ API Key '${keyName}' set successfully`));
      await config.close();
    } catch (error) {
      console.error(chalk.red('❌ Error setting API key:'), error.message);
      process.exit(1);
    }
  });

program
  .command('apikey:generate')
  .description('Generate a new secure API key')
  .option('-n, --name <name>', 'API key name')
  .option('-s, --service <service>', 'Service name')
  .option('-e, --environment <environment>', 'Environment', 'production')
  .action(async (options) => {
    try {
      const newKey = generateApiKey();
      
      if (options.name) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Enter a description for this API key:',
            default: `Auto-generated API key for ${options.service || 'general'} service`
          },
          {
            type: 'confirm',
            name: 'save',
            message: 'Save this API key to the database?',
            default: true
          }
        ]);
        
        if (answers.save) {
          await config.setApiKey(
            options.name,
            newKey,
            answers.description,
            options.service || 'general',
            options.environment
          );
          console.log(chalk.green(`✅ API Key '${options.name}' saved successfully`));
        }
      }
      
      console.log(chalk.blue('\n🔑 Generated API Key:'));
      console.log(chalk.yellow(`${newKey}`));
      console.log(chalk.red('\n⚠️  Save this key securely - it won\'t be shown again!'));
      await config.close();
    } catch (error) {
      console.error(chalk.red('❌ Error generating API key:'), error.message);
      process.exit(1);
    }
  });

// Setup command
program
  .command('setup')
  .description('Interactive setup for blog API configuration')
  .action(async () => {
    try {
      console.log(chalk.blue('\n🔧 Blog API Configuration Setup'));
      console.log('================================');
      
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiUrl',
          message: 'Blog API URL:',
          default: 'https://bapi.ingasti.com/api'
        },
        {
          type: 'input',
          name: 'userId',
          message: 'Default user ID for publishing:',
          default: '1'
        },
        {
          type: 'confirm',
          name: 'generateApiKey',
          message: 'Generate a new API key?',
          default: true
        }
      ]);
      
      // Set configuration values
      await config.setConfig('blog_api_url', answers.apiUrl, 'Blog API base URL', 'blog');
      await config.setConfig('blog_user_id', answers.userId, 'Default user ID for blog posts', 'blog');
      
      let apiKey = null;
      if (answers.generateApiKey) {
        apiKey = generateApiKey();
        await config.setApiKey(
          'blog_publish_api_key',
          apiKey,
          'API key for automated blog publishing',
          'blog',
          'production'
        );
        console.log(chalk.green('✅ New API key generated and saved'));
      }
      
      console.log(chalk.blue('\n📋 Configuration Summary:'));
      console.log(`API URL: ${answers.apiUrl}`);
      console.log(`User ID: ${answers.userId}`);
      if (apiKey) {
        console.log(`API Key: ${apiKey}`);
      }
      
      console.log(chalk.green('\n🎉 Setup complete!'));
      await config.close();
    } catch (error) {
      console.error(chalk.red('❌ Setup failed:'), error.message);
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Test database connection and configuration')
  .action(async () => {
    try {
      console.log(chalk.blue('\n🔍 Testing Configuration'));
      console.log('========================');
      
      // Test database connection
      await config.connect();
      console.log(chalk.green('✅ Database connection successful'));
      
      // Test getting blog API URL
      const apiUrl = await config.getConfig('blog_api_url');
      console.log(chalk.green('✅ Blog API URL:'), apiUrl);
      
      // Test getting API key
      const apiKey = await config.getApiKey('blog_publish_api_key');
      console.log(chalk.green('✅ API Key found:'), `${apiKey.substring(0, 16)}...`);
      
      console.log(chalk.green('\n🎉 All tests passed!'));
      await config.close();
    } catch (error) {
      console.error(chalk.red('❌ Test failed:'), error.message);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show configuration statistics')
  .action(async () => {
    try {
      console.log(chalk.blue('\n📊 Configuration Statistics'));
      console.log('============================');
      
      const configs = await config.listConfig();
      const apiKeys = await config.listApiKeys();
      
      console.log(`Total configurations: ${configs.length}`);
      console.log(`Total API keys: ${apiKeys.length}`);
      console.log(`Active API keys: ${apiKeys.filter(k => k.is_active).length}`);
      
      // Group by category
      const categories = configs.reduce((acc, conf) => {
        acc[conf.category] = (acc[conf.category] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\nConfigurations by category:');
      Object.entries(categories).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
      });
      
      // Group by service
      const services = apiKeys.reduce((acc, key) => {
        acc[key.service] = (acc[key.service] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\nAPI keys by service:');
      Object.entries(services).forEach(([service, count]) => {
        console.log(`  ${service}: ${count}`);
      });
      
      await config.close();
    } catch (error) {
      console.error(chalk.red('❌ Error getting stats:'), error.message);
      process.exit(1);
    }
  });

program
  .name('system-config')
  .description('System Configuration Management CLI')
  .version('1.0.0');

program.parse();
