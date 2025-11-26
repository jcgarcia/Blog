import express from 'express';
import { getDbPool } from '../db.js';

const router = express.Router();

// Simple test endpoint to debug comments
router.get('/test-comments/:postId', async (req, res) => {
  const { postId } = req.params;
  const pool = getDbPool();
  
  try {
    console.log(`Testing comments for post ${postId}`);
    
    // Test the exact query
    const result = await pool.query(`
      SELECT 
        c.id, c.post_id, c.parent_id, c.content, c.is_approved,
        c.created_at, c.updated_at, c.user_id,
        su.username, su.display_name
      FROM comments c
      LEFT JOIN social_users su ON c.user_id = su.id
      WHERE c.post_id = $1 AND c.is_deleted = false AND c.is_approved = true
      ORDER BY c.created_at ASC
    `, [postId]);
    
    console.log(`Found ${result.rows.length} comments`);
    
    res.json({
      success: true,
      comments: result.rows.map(row => ({
        id: row.id,
        postId: row.post_id,
        parentId: row.parent_id,
        content: row.content,
        isApproved: row.is_approved,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: {
          id: row.user_id,
          username: row.username,
          displayName: row.display_name || row.username || 'Anonymous'
        }
      })),
      count: result.rows.length
    });
  } catch (err) {
    console.error('Error in test comments:', err);
    res.status(500).json({ 
      error: 'Failed to fetch comments',
      details: err.message 
    });
  }
});

export default router;