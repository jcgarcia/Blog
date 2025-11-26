#!/usr/bin/env node

import argon2 from 'argon2';
import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

const { Client } = pg;

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

class AdminUserCreator {
  constructor() {
    const sslConfig = process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: true,
      ca: fs.readFileSync(join(__dirname, 'rds-combined-ca-bundle.pem')).toString()
    } : false;

    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig
    });
  }

  async connect() {
    try {
      await this.client.connect();
      console.log(`${colors.green}✅ Connected to database${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}❌ Database connection failed:${colors.reset}`, error.message);
      process.exit(1);
    }
  }

  async disconnect() {
    await this.client.end();
  }

  async hashPassword(password) {
    return await argon2.hash(password);
  }

  async createAdminUser(userData) {
    const {
      username,
      email,
      password,
      firstName = 'Admin',
      lastName = 'User',
      role = 'admin'
    } = userData;

    try {
      // Check if user already exists
      const existingUser = await this.client.query(
        'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        const existing = existingUser.rows[0];
        console.log(`${colors.yellow}⚠️  User already exists:${colors.reset}`);
        console.log(`   Username: ${existing.username}`);
        console.log(`   Email: ${existing.email}`);
        console.log(`   ID: ${existing.id}`);
        return null;
      }

      // Hash password
      console.log(`${colors.blue}🔐 Hashing password...${colors.reset}`);
      const passwordHash = await this.hashPassword(password);

      // Create user
      const result = await this.client.query(`
        INSERT INTO users (
          username, email, password_hash, first_name, last_name, 
          role, is_active, email_verified, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id, username, email, role, created_at
      `, [
        username,
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        true,
        true
      ]);

      const newUser = result.rows[0];
      
      console.log(`${colors.green}✅ Admin user created successfully!${colors.reset}`);
      console.log('');
      console.log(`${colors.bright}User Details:${colors.reset}`);
      console.log(`   ID: ${newUser.id}`);
      console.log(`   Username: ${newUser.username}`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Role: ${newUser.role}`);
      console.log(`   Created: ${new Date(newUser.created_at).toLocaleString()}`);

      return newUser;

    } catch (error) {
      console.error(`${colors.red}❌ Failed to create admin user:${colors.reset}`, error.message);
      throw error;
    }
  }

  async updateExistingUser(identifier, updates) {
    try {
      const { password, role, firstName, lastName, isActive } = updates;
      
      // Build dynamic query
      const setParts = [];
      const values = [];
      let paramCount = 1;

      if (password) {
        const passwordHash = await this.hashPassword(password);
        setParts.push(`password_hash = $${paramCount++}`);
        values.push(passwordHash);
      }

      if (role) {
        setParts.push(`role = $${paramCount++}`);
        values.push(role);
      }

      if (firstName) {
        setParts.push(`first_name = $${paramCount++}`);
        values.push(firstName);
      }

      if (lastName) {
        setParts.push(`last_name = $${paramCount++}`);
        values.push(lastName);
      }

      if (isActive !== undefined) {
        setParts.push(`is_active = $${paramCount++}`);
        values.push(isActive);
      }

      if (setParts.length === 0) {
        console.log(`${colors.yellow}⚠️  No updates provided${colors.reset}`);
        return null;
      }

      setParts.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(identifier);

      const query = `
        UPDATE users 
        SET ${setParts.join(', ')}
        WHERE username = $${paramCount} OR email = $${paramCount} OR id::text = $${paramCount}
        RETURNING id, username, email, role, is_active, updated_at
      `;

      const result = await this.client.query(query, values);

      if (result.rows.length === 0) {
        console.log(`${colors.red}❌ User not found: ${identifier}${colors.reset}`);
        return null;
      }

      const updatedUser = result.rows[0];
      console.log(`${colors.green}✅ User updated successfully!${colors.reset}`);
      console.log('');
      console.log(`${colors.bright}Updated User:${colors.reset}`);
      console.log(`   ID: ${updatedUser.id}`);
      console.log(`   Username: ${updatedUser.username}`);
      console.log(`   Email: ${updatedUser.email}`);
      console.log(`   Role: ${updatedUser.role}`);
      console.log(`   Active: ${updatedUser.is_active}`);
      console.log(`   Updated: ${new Date(updatedUser.updated_at).toLocaleString()}`);

      return updatedUser;

    } catch (error) {
      console.error(`${colors.red}❌ Failed to update user:${colors.reset}`, error.message);
      throw error;
    }
  }

  async listAdminUsers() {
    try {
      const result = await this.client.query(`
        SELECT id, username, email, first_name, last_name, role, 
               is_active, email_verified, last_login_at, created_at
        FROM users 
        WHERE role IN ('admin', 'super_admin', 'editor')
        ORDER BY role, username
      `);

      if (result.rows.length === 0) {
        console.log(`${colors.yellow}⚠️  No admin users found${colors.reset}`);
        return [];
      }

      console.log(`${colors.blue}Admin Users (${result.rows.length}):${colors.reset}`);
      console.log('');

      result.rows.forEach((user, index) => {
        const status = user.is_active ? `${colors.green}Active${colors.reset}` : `${colors.red}Inactive${colors.reset}`;
        const verified = user.email_verified ? '✅' : '❌';
        const lastLogin = user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never';

        console.log(`${colors.bright}${index + 1}. ${user.username}${colors.reset}`);
        console.log(`   Email: ${user.email} ${verified}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${status}`);
        console.log(`   Last Login: ${lastLogin}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log('');
      });

      return result.rows;

    } catch (error) {
      console.error(`${colors.red}❌ Failed to list admin users:${colors.reset}`, error.message);
      throw error;
    }
  }

  generateSecurePassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}

function showHelp() {
  console.log(`${colors.blue}👤 Secure Admin User Creator${colors.reset}`);
  console.log(`${colors.blue}=============================${colors.reset}`);
  console.log('');
  console.log('Usage: node create-admin-user.js [command] [options]');
  console.log('');
  console.log('Commands:');
  console.log('  create                    Create a new admin user (interactive & secure)');
  console.log('  create --quick            Create admin user with secure random username');
  console.log('  update <username/email>   Update existing user');
  console.log('  list                      List all admin users');
  console.log('  generate-password         Generate a secure password');
  console.log('');
  console.log('Options:');
  console.log('  --username <name>         Username for the admin user');
  console.log('  --email <email>           Email address');
  console.log('  --password <password>     Password (auto-generated if not provided)');
  console.log('  --first-name <name>       First name');
  console.log('  --last-name <name>        Last name');
  console.log('  --role <role>             Role (admin, super_admin, editor)');
  console.log('  --help                    Show this help');
  console.log('');
  console.log(`${colors.red}🛡️  Security Recommendations:${colors.reset}`);
  console.log(`${colors.red}   ✗ AVOID: admin, administrator, root, user, manager${colors.reset}`);
  console.log(`${colors.green}   ✓ USE: sysop_xyz, ops123, ctrl_abc, your_initials${colors.reset}`);
  console.log(`${colors.green}   ✓ Long passwords (16+ chars) with mixed characters${colors.reset}`);
  console.log(`${colors.green}   ✓ Unique email addresses for each admin${colors.reset}`);
  console.log('');
  console.log('Examples:');
  console.log('  node create-admin-user.js create --quick           # Secure random username');
  console.log('  node create-admin-user.js create                   # Interactive with suggestions');
  console.log('  node create-admin-user.js create --username sysop_jc --email julio@ingasti.com');
  console.log('  node create-admin-user.js update admin --password newpassword123');
  console.log('  node create-admin-user.js list');
  console.log('');
}

async function interactiveCreate(creator) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

  try {
    console.log(`${colors.blue}🔧 Interactive Admin User Creation${colors.reset}`);
    console.log('');
    console.log(`${colors.red}🛡️  Security Best Practices:${colors.reset}`);
    console.log(`${colors.red}   • Avoid common usernames: admin, administrator, root, user${colors.reset}`);
    console.log(`${colors.red}   • Use unique usernames: sysop, manager, ops, your_initials${colors.reset}`);
    console.log(`${colors.red}   • Mix letters and numbers for better security${colors.reset}`);
    console.log('');

    // Generate secure username suggestions
    const suggestions = [
      `sysop_${Math.random().toString(36).substring(2, 6)}`,
      `mgr_${Math.random().toString(36).substring(2, 6)}`,
      `ops_${Math.random().toString(36).substring(2, 6)}`,
      `ctrl_${Math.random().toString(36).substring(2, 6)}`
    ];

    console.log(`${colors.green}💡 Secure Username Suggestions:${colors.reset}`);
    suggestions.forEach((suggestion, index) => {
      console.log(`   ${index + 1}. ${suggestion}`);
    });
    console.log('');

    const username = await question('Username (or pick from suggestions above): ');
    const email = await question('Email: ');
    const firstName = await question('First Name [System]: ') || 'System';
    const lastName = await question('Last Name [Operator]: ') || 'Operator';
    
    const useGeneratedPassword = await question('Generate secure password? (y/n) [y]: ');
    let password;
    
    if (useGeneratedPassword.toLowerCase() === 'n') {
      console.log(`${colors.yellow}Password Requirements:${colors.reset}`);
      console.log(`${colors.yellow}   • Minimum 12 characters${colors.reset}`);
      console.log(`${colors.yellow}   • Mix of uppercase, lowercase, numbers, symbols${colors.reset}`);
      console.log(`${colors.yellow}   • Avoid dictionary words${colors.reset}`);
      console.log('');
      password = await question('Password: ');
      
      // Basic password strength check
      if (password.length < 12) {
        console.log(`${colors.red}⚠️  Warning: Password is shorter than recommended (12+ chars)${colors.reset}`);
      }
    } else {
      password = creator.generateSecurePassword(20); // Longer for better security
      console.log(`${colors.green}Generated secure password: ${password}${colors.reset}`);
    }

    const role = await question('Role (admin/super_admin/editor) [super_admin]: ') || 'super_admin';

    console.log('');
    console.log(`${colors.blue}Creating admin user...${colors.reset}`);

    const user = await creator.createAdminUser({
      username,
      email,
      password,
      firstName,
      lastName,
      role
    });

    if (user) {
      console.log('');
      console.log(`${colors.green}${colors.bright}🎉 Secure Admin User Created!${colors.reset}`);
      console.log('');
      console.log(`${colors.blue}Frontend Login Instructions:${colors.reset}`);
      console.log(`1. Go to: https://blog.ingasti.com/adminlogin`);
      console.log(`2. Username: ${username}`);
      console.log(`3. Password: ${password}`);
      console.log('');
      console.log(`${colors.red}🔐 CRITICAL SECURITY REMINDERS:${colors.reset}`);
      console.log(`${colors.red}   • Save these credentials in a password manager${colors.reset}`);
      console.log(`${colors.red}   • Never share these credentials${colors.reset}`);
      console.log(`${colors.red}   • Use 2FA if available in production${colors.reset}`);
      console.log(`${colors.red}   • Regularly rotate passwords${colors.reset}`);
      console.log(`${colors.red}   • Monitor login attempts and access logs${colors.reset}`);
    }

  } finally {
    rl.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    showHelp();
    return;
  }

  const creator = new AdminUserCreator();
  
  try {
    await creator.connect();

    const command = args[0];

    switch (command) {
      case 'create':
        if (args.includes('--quick')) {
          const secureUsername = `sysop_${Math.random().toString(36).substring(2, 8)}`;
          const password = creator.generateSecurePassword();
          const user = await creator.createAdminUser({
            username: secureUsername,
            email: 'sysadmin@ingasti.com',
            password: password,
            firstName: 'System',
            lastName: 'Operator',
            role: 'super_admin'
          });

          if (user) {
            console.log('');
            console.log(`${colors.green}${colors.bright}🔐 Secure Admin Credentials Created${colors.reset}`);
            console.log(`${colors.yellow}⚠️  SAVE THESE CREDENTIALS SECURELY!${colors.reset}`);
            console.log('');
            console.log(`${colors.bright}Username:${colors.reset} ${secureUsername}`);
            console.log(`${colors.bright}Password:${colors.reset} ${password}`);
            console.log('');
            console.log(`${colors.blue}Login at: https://blog.ingasti.com/adminlogin${colors.reset}`);
            console.log('');
            console.log(`${colors.red}🛡️  Security Note: This username is randomly generated to avoid common attacks.${colors.reset}`);
          }
        } else {
          await interactiveCreate(creator);
        }
        break;

      case 'update':
        const identifier = args[1];
        if (!identifier) {
          console.log(`${colors.red}❌ Please provide username, email, or ID to update${colors.reset}`);
          break;
        }

        const updates = {};
        const passwordIndex = args.indexOf('--password');
        if (passwordIndex !== -1) {
          updates.password = args[passwordIndex + 1];
        }

        const roleIndex = args.indexOf('--role');
        if (roleIndex !== -1) {
          updates.role = args[roleIndex + 1];
        }

        await creator.updateExistingUser(identifier, updates);
        break;

      case 'list':
        await creator.listAdminUsers();
        break;

      case 'generate-password':
        const length = parseInt(args[1]) || 16;
        const password = creator.generateSecurePassword(length);
        console.log(`${colors.green}Generated Password:${colors.reset} ${password}`);
        break;

      default:
        console.log(`${colors.red}❌ Unknown command: ${command}${colors.reset}`);
        showHelp();
    }

  } catch (error) {
    console.error(`${colors.red}❌ Error:${colors.reset}`, error.message);
    process.exit(1);
  } finally {
    await creator.disconnect();
  }
}

main().catch(console.error);
