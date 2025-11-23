#!/usr/bin/env node
import { getDbPool } from './api/db.js';

async function checkData() {
  const pool = getDbPool();
  try {
    console.log('=== CATEGORIES ===');
    const categories = await pool.query('SELECT * FROM categories ORDER BY name');
    console.log(categories.rows);
    
    console.log('\n=== POSTS COUNT ===');
    const postsCount = await pool.query('SELECT COUNT(*) FROM posts');
    console.log('Total posts:', postsCount.rows[0].count);
    
    console.log('\n=== POSTS WITH CATEGORIES ===');
    const postsWithCat = await pool.query(`
      SELECT p.id, p.title, c.name as category_name, c.slug as category_slug, p.created_at 
      FROM posts p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ORDER BY p.created_at DESC LIMIT 10
    `);
    console.log(postsWithCat.rows);
    
    console.log('\n=== POSTS BY CATEGORY ===');
    const postsByCategory = await pool.query(`
      SELECT c.name, c.slug, COUNT(p.id) as post_count
      FROM categories c 
      LEFT JOIN posts p ON c.id = p.category_id
      GROUP BY c.id, c.name, c.slug
      ORDER BY c.name
    `);
    console.log(postsByCategory.rows);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

checkData();
