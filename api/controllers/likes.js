import { getDbPool } from '../db.js';
import jwt from 'jsonwebtoken';

// Get likes for a post (includes user's like status if authenticated)
export async function getLikes(req, res) {
  const { postId } = req.params;
  const pool = getDbPool();
  
  try {
    // Get total like count
    const countResult = await pool.query('SELECT COUNT(*) AS likes FROM post_likes WHERE post_id = $1', [postId]);
    const likeCount = parseInt(countResult.rows[0].likes);
    
    // Check if user has liked this post (if authenticated)
    let userHasLiked = false;
    const token = req.cookies.access_token || req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      try {
        const userInfo = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const userLikeResult = await pool.query(
          'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2', 
          [postId, userInfo.id]
        );
        userHasLiked = userLikeResult.rows.length > 0;
      } catch (authError) {
        // Invalid token, proceed without user status
        console.log('Invalid token for like status check:', authError.message);
      }
    }
    
    res.json({ 
      likes: likeCount,
      userHasLiked: userHasLiked
    });
  } catch (err) {
    console.error('Error fetching likes:', err);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
}

// Add/remove like (toggle functionality)
export async function toggleLike(req, res) {
  const { postId } = req.params;
  const pool = getDbPool();
  
  // Check for authentication
  const token = req.cookies.access_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required to like posts' });
  }
  
  try {
    const userInfo = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = userInfo.id;
    
    // Check if user has already liked this post
    const existingLike = await pool.query(
      'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2', 
      [postId, userId]
    );
    
    let liked = false;
    
    if (existingLike.rows.length > 0) {
      // Remove like
      await pool.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      liked = false;
    } else {
      // Add like
      await pool.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
      liked = true;
    }
    
    // Update like count in posts table
    const likeCountResult = await pool.query('SELECT COUNT(*) AS count FROM post_likes WHERE post_id = $1', [postId]);
    const newLikeCount = parseInt(likeCountResult.rows[0].count);
    
    await pool.query('UPDATE posts SET like_count = $1 WHERE id = $2', [newLikeCount, postId]);
    
    res.json({ 
      success: true,
      liked: liked,
      likeCount: newLikeCount
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    console.error('Error toggling like:', err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
}

// Legacy functions for backward compatibility
export async function addLike(req, res) {
  // Redirect to toggle function
  return toggleLike(req, res);
}

export async function removeLike(req, res) {
  // Redirect to toggle function  
  return toggleLike(req, res);
}
