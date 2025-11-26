#!/usr/bin/env node

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function generateApiKey(length = 64) {
  return crypto.randomBytes(length / 2).toString('hex');
}

function generateReadableKey(prefix = 'blog') {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(16).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

function generateUUID() {
  return crypto.randomUUID();
}

function showHelp() {
  console.log(`${colors.blue}🔑 API Key Generator${colors.reset}`);
  console.log(`${colors.blue}===================${colors.reset}`);
  console.log('');
  console.log('Usage: node generate-api-key.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --length <n>     Generate key with specific length (default: 64)');
  console.log('  --readable       Generate human-readable key');
  console.log('  --uuid           Generate UUID-based key');
  console.log('  --multiple <n>   Generate multiple keys');
  console.log('  --save           Save key to .env file');
  console.log('  --help           Show this help');
  console.log('');
  console.log('Examples:');
  console.log('  node generate-api-key.js');
  console.log('  node generate-api-key.js --length 128');
  console.log('  node generate-api-key.js --readable');
  console.log('  node generate-api-key.js --multiple 5');
  console.log('  node generate-api-key.js --save');
  console.log('');
}

function saveToEnv(apiKey) {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  
  // Read existing .env file if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Check if PUBLISH_API_KEY already exists
  if (envContent.includes('PUBLISH_API_KEY=')) {
    // Replace existing key
    envContent = envContent.replace(/PUBLISH_API_KEY=.*/, `PUBLISH_API_KEY=${apiKey}`);
  } else {
    // Add new key
    if (envContent && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += `PUBLISH_API_KEY=${apiKey}\n`;
  }
  
  // Write back to file
  fs.writeFileSync(envPath, envContent);
  console.log(`${colors.green}✅ API key saved to .env file${colors.reset}`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    showHelp();
    return;
  }
  
  console.log(`${colors.blue}🔑 API Key Generator${colors.reset}`);
  console.log(`${colors.blue}===================${colors.reset}`);
  console.log('');
  
  // Parse arguments
  const lengthIndex = args.indexOf('--length');
  const length = lengthIndex !== -1 ? parseInt(args[lengthIndex + 1]) || 64 : 64;
  
  const multipleIndex = args.indexOf('--multiple');
  const multiple = multipleIndex !== -1 ? parseInt(args[multipleIndex + 1]) || 1 : 1;
  
  const readable = args.includes('--readable');
  const uuid = args.includes('--uuid');
  const save = args.includes('--save');
  
  // Generate keys
  const keys = [];
  
  for (let i = 0; i < multiple; i++) {
    let key;
    
    if (uuid) {
      key = generateUUID();
    } else if (readable) {
      key = generateReadableKey();
    } else {
      key = generateApiKey(length);
    }
    
    keys.push(key);
  }
  
  // Display keys
  if (keys.length === 1) {
    console.log(`${colors.green}Generated API Key:${colors.reset}`);
    console.log(`${colors.cyan}${keys[0]}${colors.reset}`);
    console.log('');
    console.log(`${colors.yellow}⚠️  Keep this key secure! It provides access to your blog API.${colors.reset}`);
    
    if (save) {
      saveToEnv(keys[0]);
    }
  } else {
    console.log(`${colors.green}Generated ${keys.length} API Keys:${colors.reset}`);
    keys.forEach((key, index) => {
      console.log(`${colors.cyan}${index + 1}. ${key}${colors.reset}`);
    });
  }
  
  console.log('');
  console.log(`${colors.blue}💡 Usage Instructions:${colors.reset}`);
  console.log(`${colors.blue}=====================${colors.reset}`);
  console.log('');
  console.log('1. Server Configuration:');
  console.log(`   export PUBLISH_API_KEY="${keys[0]}"`);
  console.log('');
  console.log('2. Client Configuration:');
  console.log(`   export BLOG_API_KEY="${keys[0]}"`);
  console.log('');
  console.log('3. Test your setup:');
  console.log('   ./blog-config.sh test');
  console.log('');
  console.log('4. Publish a post:');
  console.log('   ./blog-publish your-post.md');
  console.log('');
  
  // Show security recommendations
  console.log(`${colors.red}🔐 Security Recommendations:${colors.reset}`);
  console.log(`${colors.red}=============================${colors.reset}`);
  console.log('• Store keys in environment variables, not in code');
  console.log('• Use different keys for development and production');
  console.log('• Rotate keys regularly (monthly recommended)');
  console.log('• Monitor API key usage for suspicious activity');
  console.log('• Use HTTPS for all API communications');
  console.log('');
}

main();
