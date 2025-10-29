import { getDbPool } from '../db.js';
import jwt from 'jsonwebtoken';

// Get comments for a post (with threading support)
export async function getComments(req, res) {
  const { postId } = req.params;
  const pool = getDbPool();
  
  try {
    // Get all comments for the post with user information
    const result = await pool.query(`
      SELECT 
        c.id, c.post_id, c.parent_id, c.content, c.status,
        c.created_at, c.updated_at, c.user_id,
        su.username, su.display_name
      FROM comments c
      LEFT JOIN social_users su ON c.user_id = su.id
      WHERE c.post_id = $1 AND c.status = 'approved'
      ORDER BY c.created_at ASC
    `, [postId]);
    
    // Build threaded comment structure
    const comments = [];
    const commentMap = new Map();
    
    // First pass: create comment objects
    result.rows.forEach(row => {
      const comment = {
        id: row.id,
        postId: row.post_id,
        parentId: row.parent_id,
        content: row.content,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: {
          id: row.user_id,
          username: row.username,
          displayName: row.display_name || row.username
        },
        replies: []
      };
      
      commentMap.set(row.id, comment);
      
      if (!row.parent_id) {
        comments.push(comment);
      }
    });
    
    // Second pass: build reply structure
    result.rows.forEach(row => {
      if (row.parent_id) {
        const parent = commentMap.get(row.parent_id);
        const child = commentMap.get(row.id);
        if (parent && child) {
          parent.replies.push(child);
        }
      }
    });
    
    res.json({
      success: true,
      comments: comments,
      count: result.rows.length
    });
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
}

// Add a new comment
export async function addComment(req, res) {
  const { postId } = req.params;
  const { content, parentId } = req.body;
  const pool = getDbPool();
  
  // STRICT AUTHENTICATION CHECK - NO ANONYMOUS COMMENTS ALLOWED
  const token = req.cookies.access_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required. You must be logged in to comment.',
      requiresAuth: true 
    });
  }
  
  try {
    const userInfo = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // STRICT USER VALIDATION - Ensure user exists and is valid
    if (!userInfo || !userInfo.id) {
      return res.status(401).json({ 
        error: 'Invalid user authentication. Please log in again.',
        requiresAuth: true 
      });
    }
    
    // Verify user exists in database
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userInfo.id]);
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ 
        error: 'User account not found. Please log in again.',
        requiresAuth: true 
      });
    }
    
    // Validate content
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Comment is too long (max 2000 characters)' });
    }
    
    // Validate parent comment exists if parentId provided
    if (parentId) {
      const parentCheck = await pool.query(
        'SELECT id FROM comments WHERE id = $1 AND post_id = $2', 
        [parentId, postId]
      );
      
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Parent comment not found' });
      }
    }
    
    // Find or create social user mapping for this user
    let socialUserId;
    const socialUserCheck = await pool.query(
      'SELECT id FROM social_users WHERE cognito_sub = $1 OR username = $2', 
      [userInfo.id.toString(), userInfo.username]
    );
    
    if (socialUserCheck.rows.length > 0) {
      socialUserId = socialUserCheck.rows[0].id;
    } else {
      // Create social user entry for this regular user
      const createSocialUser = await pool.query(`
        INSERT INTO social_users (cognito_sub, username, email, display_name, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING id
      `, [
        userInfo.id.toString(), 
        userInfo.username || `user_${userInfo.id}`, 
        userInfo.email || `user_${userInfo.id}@blog.local`,
        userInfo.first_name && userInfo.last_name 
          ? `${userInfo.first_name} ${userInfo.last_name}`
          : userInfo.username || `User ${userInfo.id}`
      ]);
      socialUserId = createSocialUser.rows[0].id;
    }
    
    // Insert new comment with social user ID  
    const result = await pool.query(`
      INSERT INTO comments (post_id, user_id, parent_id, content, status)
      VALUES ($1, $2, $3, $4, 'approved')
      RETURNING id, created_at
    `, [postId, socialUserId, parentId || null, content.trim()]);
    
    const commentId = result.rows[0].id;
    const createdAt = result.rows[0].created_at;
    
    // Update comment count in posts table
    const countResult = await pool.query('SELECT COUNT(*) AS count FROM comments WHERE post_id = $1 AND status = $2', [postId, 'approved']);
    const newCommentCount = parseInt(countResult.rows[0].count);
    
    await pool.query('UPDATE posts SET comment_count = $1 WHERE id = $2', [newCommentCount, postId]);
    
    // Get social user info for response
    const socialUserResult = await pool.query(
      'SELECT username, display_name FROM social_users WHERE id = $1', 
      [userInfo.id]
    );
    
    const socialUser = socialUserResult.rows[0];
    
    res.json({
      success: true,
      comment: {
        id: commentId,
        postId: parseInt(postId),
        parentId: parentId ? parseInt(parentId) : null,
        content: content.trim(),
        status: 'approved',
        createdAt: createdAt,
        author: {
          id: userInfo.id,
          username: socialUser.username,
          displayName: socialUser.display_name || socialUser.username
        },
        replies: []
      },
      commentCount: newCommentCount
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    console.error('Error adding comment:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

// Update a comment (edit)
export async function updateComment(req, res) {
  const { commentId } = req.params;
  const { content } = req.body;
  const pool = getDbPool();
  
  // Check for authentication
  const token = req.cookies.access_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const userInfo = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Validate content
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Comment is too long (max 2000 characters)' });
    }
    
    // Check if comment exists and user owns it (or is admin)
    const commentCheck = await pool.query(
      'SELECT user_id FROM comments WHERE id = $1', 
      [commentId]
    );
    
    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const isOwner = commentCheck.rows[0].user_id === userInfo.id;
    const isAdmin = ['admin', 'super_admin'].includes(userInfo.role);
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }
    
    // Update comment
    await pool.query(`
      UPDATE comments 
      SET content = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [content.trim(), commentId]);
    
    res.json({
      success: true,
      message: 'Comment updated successfully'
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    console.error('Error updating comment:', err);
    res.status(500).json({ error: 'Failed to update comment' });
  }
}

// Delete a comment (soft delete)
export async function deleteComment(req, res) {
  const { commentId } = req.params;
  const pool = getDbPool();
  
  // Check for authentication
  const token = req.cookies.access_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const userInfo = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if comment exists and user owns it (or is admin)
    const commentCheck = await pool.query(
      'SELECT user_id, post_id FROM comments WHERE id = $1', 
      [commentId]
    );
    
    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    const isOwner = commentCheck.rows[0].user_id === userInfo.id;
    const isAdmin = ['admin', 'super_admin'].includes(userInfo.role);
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }
    
    const postId = commentCheck.rows[0].post_id;
    
    // Soft delete comment (preserve threading structure)
    await pool.query(`
      UPDATE comments 
      SET status = 'deleted', content = '[deleted]', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [commentId]);
    
    // Update comment count in posts table
    const countResult = await pool.query('SELECT COUNT(*) AS count FROM comments WHERE post_id = $1 AND status = $2', [postId, 'approved']);
    const newCommentCount = parseInt(countResult.rows[0].count);
    
    await pool.query('UPDATE posts SET comment_count = $1 WHERE id = $2', [newCommentCount, postId]);
    
    res.json({
      success: true,
      message: 'Comment deleted successfully',
      commentCount: newCommentCount
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    console.error('Error deleting comment:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
}

// Track social media shares
export async function trackShare(req, res) {
  const { postId } = req.params;
  const { platform } = req.body;
  const pool = getDbPool();
  
  try {
    let userId = null;
    
    // Try to get user from token (optional for sharing)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (tokenError) {
        // Ignore token errors for sharing (allow anonymous sharing)
        console.log('Anonymous share tracked');
      }
    }
    
    // Validate platform
    const validPlatforms = ['facebook', 'twitter', 'linkedin', 'whatsapp', 'copy_link', 'native'];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform' });
    }
    
    // Check if post exists
    const postCheck = await pool.query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Get client IP for anonymous tracking
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    // Record the share
    await pool.query(`
      INSERT INTO post_shares (post_id, platform, user_id, ip_address, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [postId, platform, userId, clientIP]);
    
    // Update share count in posts table
    const countResult = await pool.query('SELECT COUNT(*) AS count FROM post_shares WHERE post_id = $1', [postId]);
    const newShareCount = parseInt(countResult.rows[0].count);
    
    await pool.query('UPDATE posts SET share_count = $1 WHERE id = $2', [newShareCount, postId]);
    
    res.json({
      success: true,
      message: 'Share tracked successfully',
      shareCount: newShareCount
    });
  } catch (err) {
    console.error('Error tracking share:', err);
    res.status(500).json({ error: 'Failed to track share' });
  }
}

// Get share statistics for a post
export async function getShareStats(req, res) {
  const { postId } = req.params;
  const pool = getDbPool();
  
  try {
    // Check if post exists
    const postCheck = await pool.query('SELECT id, share_count FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Get share breakdown by platform
    const platformStats = await pool.query(`
      SELECT platform, COUNT(*) as count
      FROM post_shares 
      WHERE post_id = $1 
      GROUP BY platform
      ORDER BY count DESC
    `, [postId]);
    
    // Get recent shares (last 10)
    const recentShares = await pool.query(`
      SELECT ps.platform, ps.created_at, u.username, u.first_name, u.last_name
      FROM post_shares ps
      LEFT JOIN users u ON ps.user_id = u.id
      WHERE ps.post_id = $1
      ORDER BY ps.created_at DESC
      LIMIT 10
    `, [postId]);
    
    res.json({
      success: true,
      data: {
        totalShares: postCheck.rows[0].share_count || 0,
        platformBreakdown: platformStats.rows.reduce((acc, row) => {
          acc[row.platform] = parseInt(row.count);
          return acc;
        }, {}),
        recentShares: recentShares.rows.map(row => ({
          platform: row.platform,
          createdAt: row.created_at,
          user: row.username ? {
            username: row.username,
            displayName: row.first_name && row.last_name 
              ? `${row.first_name} ${row.last_name}`
              : row.username
          } : null
        }))
      }
    });
  } catch (err) {
    console.error('Error getting share stats:', err);
    res.status(500).json({ error: 'Failed to get share statistics' });
  }
}