import { getDbPool } from '../db.js';

// Track a view for a post
export async function trackView(req, res) {
  const { postId } = req.params;
  const pool = getDbPool();
  
  try {
    // Validate post ID
    if (!postId || isNaN(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID'
      });
    }

    // Check if post exists and is published
    const postCheck = await pool.query(
      'SELECT id, status FROM posts WHERE id = $1',
      [postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const post = postCheck.rows[0];
    
    // Only track views for published posts
    if (post.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Cannot track views for unpublished posts'
      });
    }

    // Increment view count
    const updateResult = await pool.query(
      'UPDATE posts SET view_count = view_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING view_count',
      [postId]
    );

    const newViewCount = updateResult.rows[0].view_count;

    // Optional: Track individual view records for analytics (if analytics table exists)
    try {
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
      
      await pool.query(
        `INSERT INTO analytics (post_id, event_type, user_agent, ip_address, created_at) 
         VALUES ($1, 'view', $2, $3, CURRENT_TIMESTAMP)`,
        [postId, userAgent, ipAddress]
      );
    } catch (analyticsError) {
      // Analytics insertion is optional - don't fail the main request if it fails
      console.log('Analytics tracking failed (optional):', analyticsError.message);
    }

    res.json({
      success: true,
      postId: parseInt(postId),
      viewCount: newViewCount,
      message: 'View tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get view count for a post
export const getViewCount = async (req, res) => {
  const { postId } = req.params;
  const pool = getDbPool();
  
  try {
    if (!postId || isNaN(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID'
      });
    }

    const result = await pool.query(
      'SELECT view_count FROM posts WHERE id = $1',
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    res.json({
      success: true,
      postId: parseInt(postId),
      viewCount: result.rows[0].view_count || 0
    });

  } catch (error) {
    console.error('Error getting view count:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Functions are already exported above