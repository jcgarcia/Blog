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

async function assignTechCategory() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Get the Technology category ID
    const techCategory = await client.query("SELECT id FROM categories WHERE name = 'Technology'");
    
    if (techCategory.rows.length === 0) {
      console.error('Technology category not found!');
      return;
    }
    
    const techCategoryId = techCategory.rows[0].id;
    console.log(`Technology category ID: ${techCategoryId}`);

    // Count posts without categories
    const unassignedCount = await client.query('SELECT COUNT(*) FROM posts WHERE category_id IS NULL');
    console.log(`Posts without categories: ${unassignedCount.rows[0].count}`);

    // Assign all posts without categories to Technology
    const result = await client.query(
      'UPDATE posts SET category_id = $1 WHERE category_id IS NULL',
      [techCategoryId]
    );
    
    console.log(`✅ Successfully assigned ${result.rowCount} posts to Technology category`);

    // Verify the assignment
    const verifyResult = await client.query(`
      SELECT p.id, p.title, c.name as category_name 
      FROM posts p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ORDER BY p.created_at DESC 
      LIMIT 5
    `);
    
    console.log('\n📝 Sample posts after assignment:');
    verifyResult.rows.forEach(post => {
      console.log(`- ${post.title} → ${post.category_name}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

assignTechCategory();
