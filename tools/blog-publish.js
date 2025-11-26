#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import SystemConfigManager from '../api/utils/systemConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (for database connection)
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize system configuration manager
const configManager = new SystemConfigManager();

// Configuration (will be loaded from database)
let CONFIG = {
  API_BASE_URL: process.env.BLOG_API_URL || 'https://bapi.ingasti.com/api',
  API_KEY: process.env.BLOG_API_KEY || '',
  DEFAULT_USER_ID: process.env.BLOG_USER_ID || '1'
};

// Load configuration from database
async function loadConfig() {
  try {
    await configManager.connect();
    
    CONFIG.API_BASE_URL = await configManager.getConfig('blog_api_url').catch(() => CONFIG.API_BASE_URL);
    CONFIG.DEFAULT_USER_ID = await configManager.getConfig('blog_user_id').catch(() => CONFIG.DEFAULT_USER_ID);
    const dbApiKey = await configManager.getApiKey('blog_publish_api_key').catch(() => null);
    CONFIG.API_KEY = dbApiKey || process.env.BLOG_API_KEY || CONFIG.API_KEY;
    
    log('✅ Configuration loaded from database', 'green');
  } catch (error) {
    log('⚠️  Using fallback configuration (database unavailable)', 'yellow');
    console.error('Database error:', error.message);
  }
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function showUsage() {
  log('\n📝 Blog Post Publisher CLI', 'cyan');
  log('==============================', 'cyan');
  log('\nUsage:', 'bright');
  log('  blog-publish <markdown-file> [options]', 'blue');
  log('\nOptions:', 'bright');
  log('  --api-url <url>     API base URL (default: https://bapi.ingasti.com/api)', 'blue');
  log('  --api-key <key>     API key for authentication', 'blue');
  log('  --content           Send content directly instead of file upload', 'blue');
  log('  --help              Show this help message', 'blue');
  log('\nEnvironment Variables:', 'bright');
  log('  BLOG_API_URL        API base URL', 'blue');
  log('  BLOG_API_KEY        API key for authentication', 'blue');
  log('  BLOG_USER_ID        Default user ID for posts', 'blue');
  log('\nExamples:', 'bright');
  log('  blog-publish ./my-post.md', 'green');
  log('  blog-publish ./my-post.md --api-key your-api-key', 'green');
  log('  blog-publish ./my-post.md --content', 'green');
  log('');
}

async function publishMarkdownFile(filePath, options = {}) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    log(`📄 Publishing: ${fileName}`, 'cyan');

    const apiUrl = options.apiUrl || CONFIG.API_BASE_URL;
    const apiKey = options.apiKey || CONFIG.API_KEY;

    if (!apiKey) {
      throw new Error('API key is required. Set BLOG_API_KEY environment variable or use --api-key option.');
    }

    let response;

    if (options.content) {
      // Send content directly
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      response = await fetch(`${apiUrl}/publish/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ markdownContent: fileContent })
      });
    } else {
      // Upload file
      const formData = new FormData();
      formData.append('markdown', fs.createReadStream(filePath));

      response = await fetch(`${apiUrl}/publish/markdown`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          ...formData.getHeaders()
        },
        body: formData
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`API Error (${response.status}): ${errorData.error || errorData.message || 'Unknown error'}`);
    }

    const result = await response.json();
    
    log('✅ Post published successfully!', 'green');
    log(`📝 Title: ${result.title}`, 'blue');
    log(`🏷️  Category: ${result.category}`, 'blue');
    log(`🆔 Post ID: ${result.postId}`, 'blue');
    log(`📅 Published: ${new Date(result.publishedAt).toLocaleString()}`, 'blue');

    return result;

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function validateMarkdownFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for frontmatter
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      log('⚠️  Warning: No frontmatter found. Make sure your markdown file has frontmatter with title and description.', 'yellow');
      return false;
    }

    const frontmatterText = match[1];
    const hasTitle = frontmatterText.includes('title:');
    const hasDescription = frontmatterText.includes('description:');

    if (!hasTitle || !hasDescription) {
      log('⚠️  Warning: Missing required frontmatter fields (title, description).', 'yellow');
      return false;
    }

    log('✅ Markdown file validation passed', 'green');
    return true;

  } catch (error) {
    log(`❌ Validation error: ${error.message}`, 'red');
    return false;
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  let skipDbConfig = false;
  let filePath, options = {};
  let configLoaded = false;
  try {
    if (args.length === 0 || args.includes('--help')) {
      showUsage();
      // No DB close needed
      return;
    }

    filePath = args[0];
    options = {};
    // Parse command line options
    for (let i = 1; i < args.length; i += 2) {
      const flag = args[i];
      const value = args[i + 1];
      switch (flag) {
        case '--api-url':
          options.apiUrl = value;
          skipDbConfig = true;
          break;
        case '--api-key':
          options.apiKey = value;
          skipDbConfig = true;
          break;
        case '--content':
          options.content = true;
          i--; // This flag doesn't take a value
          break;
        default:
          log(`⚠️  Unknown option: ${flag}`, 'yellow');
      }
    }

    // Only load config from DB if not provided via CLI
    if (!skipDbConfig) {
      await loadConfig();
      configLoaded = true;
    } else {
      if (options.apiUrl) CONFIG.API_BASE_URL = options.apiUrl;
      if (options.apiKey) CONFIG.API_KEY = options.apiKey;
    }

    // Validate file
    const valid = await validateMarkdownFile(filePath);
    if (!valid) {
      log('❌ Markdown validation failed. Exiting.', 'red');
      // No DB close needed
      process.exit(1);
    }

    // Publish
    const result = await publishMarkdownFile(filePath, options);
    log(`\n🎉 ${result.message}`, 'green');
    log(`📝 Post ID: ${result.postId}`, 'blue');
    log(`📌 Title: ${result.title}`, 'blue');
    log(`🏷️  Category: ${result.category}`, 'blue');
    log(`📅 Published: ${result.publishedAt}`, 'blue');
    // No DB close needed
  } catch (error) {
    log(`\n❌ Publishing failed: ${error.message}`, 'red');
    // No DB close needed
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  log(`❌ Uncaught Exception: ${error.message}`, 'red');
  // No DB close needed
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  log(`❌ Unhandled Rejection: ${reason}`, 'red');
  // No DB close needed
  process.exit(1);
});

// Run the CLI
main().catch(error => {
  log(`❌ Error: ${error.message}`, 'red');
  process.exit(1);
});
