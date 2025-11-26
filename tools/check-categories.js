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

async function checkCategories() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check categories
    const categories = await client.query('SELECT * FROM categories ORDER BY id');
    console.log('\n📁 Categories in database:');
    console.log(categories.rows);

    // Check posts and their category assignments
    const posts = await client.query(`
      SELECT id, title, category_id, status 
      FROM posts 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log('\n📝 Recent posts and their category assignments:');
    console.log(posts.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkCategories();
