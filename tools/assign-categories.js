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

async function assignCategories() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Assign categories to existing posts based on their titles
    const assignments = [
      { postId: 8, categoryId: 1, reason: 'Direct API Test Success -> Technology' },
      { postId: 7, categoryId: 1, reason: 'Publishing System Test -> Technology' },
      { postId: 5, categoryId: 1, reason: 'Database Connection Pool Test -> Technology' },
      { postId: 4, categoryId: 3, reason: 'Test Post -> Tutorial' },
      { postId: 3, categoryId: 3, reason: 'Simple Test -> Tutorial' },
      { postId: 2, categoryId: 1, reason: 'Database Connection Test -> Technology' },
      { postId: 1, categoryId: 2, reason: 'What you can expect from copilot -> Lifestyle' }
    ];

    console.log('\n🔧 Assigning categories to posts...\n');

    for (const assignment of assignments) {
      const result = await client.query(
        'UPDATE posts SET category_id = $1 WHERE id = $2',
        [assignment.categoryId, assignment.postId]
      );
      
      if (result.rowCount > 0) {
        console.log(`✅ ${assignment.reason}`);
      } else {
        console.log(`❌ Failed to update post ${assignment.postId}`);
      }
    }

    // Verify the assignments
    console.log('\n📊 Verification - Posts by category:');
    const verification = await client.query(`
      SELECT 
        c.name as category_name,
        c.slug as category_slug,
        COUNT(p.id) as post_count,
        STRING_AGG(p.title, ', ') as post_titles
      FROM categories c
      LEFT JOIN posts p ON c.id = p.category_id
      GROUP BY c.id, c.name, c.slug
      ORDER BY c.id
    `);

    verification.rows.forEach(row => {
      console.log(`\n📁 ${row.category_name} (${row.category_slug}): ${row.post_count} posts`);
      if (row.post_titles) {
        console.log(`   Posts: ${row.post_titles}`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

assignCategories();
