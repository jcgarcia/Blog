#!/usr/bin/env node

import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: 'ingasti-pg-ingasti.c.aivencloud.com',
  port: 25306,
  database: 'blog',
  user: 'avnadmin',
  password: process.env.AIVEN_PASSWORD || 'YOUR_PASSWORD_HERE',
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  try {
    await client.connect();
    console.log('✓ Connected to database');
    
    // Check users table schema
    const usersSchema = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\nUsers table schema:');
    usersSchema.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check posts table schema
    const postsSchema = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'posts' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\nPosts table schema:');
    postsSchema.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check existing users
    const users = await client.query('SELECT * FROM users LIMIT 5;');
    console.log(`\nExisting users (${users.rows.length}):`);
    users.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${JSON.stringify(user)}`);
    });
    
    // Check existing posts
    const posts = await client.query('SELECT id, title, author_id FROM posts LIMIT 5;');
    console.log(`\nExisting posts (${posts.rows.length}):`);
    posts.rows.forEach((post, index) => {
      console.log(`  ${index + 1}. "${post.title}" - Author ID: ${post.author_id}`);
    });
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSchema();
