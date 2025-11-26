#!/usr/bin/env node

import pg from 'pg';
import argon2 from 'argon2';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Load environment variables from multiple possible locations
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load from different locations
config({ path: join(__dirname, '../api/.env') });
config({ path: join(__dirname, '.env.local') });
config({ path: join(__dirname, '.env') });

// Also try to use system environment variables
if (!process.env.PGHOST && process.env.DATABASE_URL) {
  // If we have DATABASE_URL but not individual PG vars, we might need to parse it
  console.log('Using DATABASE_URL for connection...');
}

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

class AuthorUpdater {
  constructor() {
    // Use PostgreSQL environment variables for cloud database
    const dbConfig = {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'blog_db',
      user: process.env.PGUSER || 'blog_user',
      password: process.env.PGPASSWORD,
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
    };

    if (!dbConfig.password) {
      console.error('❌ PGPASSWORD environment variable is required');
      process.exit(1);
    }

    console.log(`${colors.cyan}🔗 Connecting to database...${colors.reset}`);
    console.log(`  Host: ${dbConfig.host.replace(/\..*/, '.***')}`); // Mask sensitive parts
    console.log(`  Database: ${dbConfig.database}`);
    console.log(`  SSL: ${dbConfig.ssl ? 'enabled' : 'disabled'}`);
    console.log();

    this.client = new Client(dbConfig);
  }

  async connect() {
    try {
      await this.client.connect();
      console.log(`${colors.green}✓ Connected to PostgreSQL database${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}✗ Database connection failed:${colors.reset}`, error.message);
      process.exit(1);
    }
  }

  async disconnect() {
    try {
      await this.client.end();
      console.log(`${colors.green}✓ Database connection closed${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}✗ Error closing database connection:${colors.reset}`, error.message);
    }
  }

  async findUsers() {
    try {
      console.log(`${colors.blue}🔍 Searching for existing users...${colors.reset}`);
      
      const result = await this.client.query(`
        SELECT id, username, email, first_name, last_name, role, created_at 
        FROM users 
        ORDER BY created_at ASC
      `);

      if (result.rows.length === 0) {
        console.log(`${colors.yellow}⚠️  No users found in database${colors.reset}`);
        return [];
      }

      console.log(`${colors.green}✓ Found ${result.rows.length} user(s):${colors.reset}`);
      result.rows.forEach((user, index) => {
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'No name';
        console.log(`  ${index + 1}. ${colors.cyan}${user.username}${colors.reset} (${fullName}) - ${user.email} - Role: ${user.role}`);
      });

      return result.rows;
    } catch (error) {
      console.error(`${colors.red}✗ Error finding users:${colors.reset}`, error.message);
      throw error;
    }
  }

  async findPosts() {
    try {
      console.log(`${colors.blue}🔍 Searching for existing posts...${colors.reset}`);
      
      const result = await this.client.query(`
        SELECT p.id, p.title, p.slug, p.author_id, u.username, u.first_name, u.last_name, p.status, p.created_at
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        ORDER BY p.created_at ASC
      `);

      if (result.rows.length === 0) {
        console.log(`${colors.yellow}⚠️  No posts found in database${colors.reset}`);
        return [];
      }

      console.log(`${colors.green}✓ Found ${result.rows.length} post(s):${colors.reset}`);
      result.rows.forEach((post, index) => {
        const fullName = [post.first_name, post.last_name].filter(Boolean).join(' ') || 'No name';
        const authorInfo = post.username ? `${post.username} (${fullName})` : 'Unknown author';
        console.log(`  ${index + 1}. "${colors.cyan}${post.title}${colors.reset}" - Author: ${authorInfo} - Status: ${post.status}`);
      });

      return result.rows;
    } catch (error) {
      console.error(`${colors.red}✗ Error finding posts:${colors.reset}`, error.message);
      throw error;
    }
  }

  async findOrCreateJcgarciaUser() {
    try {
      console.log(`${colors.blue}🔍 Looking for jcgarcia user...${colors.reset}`);
      
      // First try to find existing jcgarcia user
      let result = await this.client.query(`
        SELECT id, username, email, first_name, last_name, role 
        FROM users 
        WHERE username = $1
      `, ['jcgarcia']);

      if (result.rows.length > 0) {
        const user = result.rows[0];
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'No name';
        console.log(`${colors.green}✓ Found existing jcgarcia user:${colors.reset}`);
        console.log(`  ID: ${user.id}, Username: ${user.username}, Name: ${fullName}, Role: ${user.role}`);
        return user;
      }

      // If not found, create the user
      console.log(`${colors.yellow}⚠️  jcgarcia user not found. Creating new user...${colors.reset}`);
      
      // Generate a proper Argon2 hash for dummy password (user is just for attribution)
      const dummyPasswordHash = await argon2.hash('dummy_password_for_attribution_only');
      
      const insertResult = await this.client.query(`
        INSERT INTO users (username, email, first_name, last_name, password_hash, role, is_active, email_verified, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, username, email, first_name, last_name, role
      `, [
        'jcgarcia',
        'jcgarcia@example.com', // You may want to update this with actual email
        'jcgarcia',
        '',
        dummyPasswordHash, // Proper Argon2 hash for dummy password
        'author',
        true,
        true
      ]);

      const newUser = insertResult.rows[0];
      const fullName = [newUser.first_name, newUser.last_name].filter(Boolean).join(' ') || 'No name';
      console.log(`${colors.green}✓ Created jcgarcia user:${colors.reset}`);
      console.log(`  ID: ${newUser.id}, Username: ${newUser.username}, Name: ${fullName}, Role: ${newUser.role}`);
      
      return newUser;
    } catch (error) {
      console.error(`${colors.red}✗ Error finding/creating jcgarcia user:${colors.reset}`, error.message);
      throw error;
    }
  }

  async updatePostAuthors(targetUserId) {
    try {
      console.log(`${colors.blue}🔄 Updating post authors to jcgarcia (ID: ${targetUserId})...${colors.reset}`);
      
      // First, find posts that need updating
      const postsToUpdate = await this.client.query(`
        SELECT p.id, p.title, p.author_id, u.username as current_author
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        WHERE p.author_id != $1 OR p.author_id IS NULL
      `, [targetUserId]);

      if (postsToUpdate.rows.length === 0) {
        console.log(`${colors.green}✓ All posts are already assigned to jcgarcia${colors.reset}`);
        return { updated: 0, total: 0 };
      }

      console.log(`${colors.yellow}📝 Found ${postsToUpdate.rows.length} post(s) to update:${colors.reset}`);
      postsToUpdate.rows.forEach((post, index) => {
        console.log(`  ${index + 1}. "${post.title}" - Current author: ${post.current_author || 'None'}`);
      });

      // Update all posts to be authored by jcgarcia
      const updateResult = await this.client.query(`
        UPDATE posts 
        SET author_id = $1, updated_at = NOW()
        WHERE author_id != $1 OR author_id IS NULL
        RETURNING id, title
      `, [targetUserId]);

      console.log(`${colors.green}✓ Successfully updated ${updateResult.rows.length} post(s) to be authored by jcgarcia${colors.reset}`);
      
      return {
        updated: updateResult.rows.length,
        total: postsToUpdate.rows.length,
        updatedPosts: updateResult.rows
      };
    } catch (error) {
      console.error(`${colors.red}✗ Error updating post authors:${colors.reset}`, error.message);
      throw error;
    }
  }

  async run() {
    try {
      console.log(`${colors.bright}${colors.magenta}📝 Blog Post Author Updater${colors.reset}`);
      console.log(`${colors.bright}${colors.magenta}==============================${colors.reset}\n`);

      await this.connect();

      // Show current state
      console.log(`${colors.bright}Current Database State:${colors.reset}`);
      await this.findUsers();
      console.log();
      await this.findPosts();
      console.log();

      // Find or create jcgarcia user
      const jcgarciaUser = await this.findOrCreateJcgarciaUser();
      console.log();

      // Update post authors
      const result = await this.updatePostAuthors(jcgarciaUser.id);
      
      console.log(`\n${colors.bright}${colors.green}Update Summary:${colors.reset}`);
      console.log(`  Posts updated: ${result.updated}`);
      console.log(`  Total posts checked: ${result.total || 'All posts already correct'}`);
      
      if (result.updatedPosts && result.updatedPosts.length > 0) {
        console.log(`\n${colors.bright}Updated Posts:${colors.reset}`);
        result.updatedPosts.forEach((post, index) => {
          console.log(`  ${index + 1}. "${post.title}"`);
        });
      }

      console.log(`\n${colors.green}✅ Author update process completed successfully!${colors.reset}`);

    } catch (error) {
      console.error(`${colors.red}❌ Author update failed:${colors.reset}`, error.message);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const updater = new AuthorUpdater();
  updater.run().catch(console.error);
}

export default AuthorUpdater;
