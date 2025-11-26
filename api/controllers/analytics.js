import { getDbPool } from '../db.js';

// Get dashboard analytics data
export const getDashboardAnalytics = async (req, res) => {
  const pool = getDbPool();
  
  try {
    // Get total posts
    const postsResult = await pool.query('SELECT COUNT(*) as count FROM posts WHERE status = $1', ['published']);
    const totalPosts = parseInt(postsResult.rows[0].count);

    // Get total views
    const viewsResult = await pool.query('SELECT SUM(view_count) as total FROM posts WHERE status = $1', ['published']);
    const totalViews = parseInt(viewsResult.rows[0].total) || 0;

    // Get this month's views (approximate - based on when posts were updated with views)
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    
    const thisMonthResult = await pool.query(
      'SELECT SUM(view_count) as total FROM posts WHERE status = $1 AND updated_at >= $2',
      ['published', thisMonthStart]
    );
    const thisMonthViews = parseInt(thisMonthResult.rows[0].total) || 0;

    // Get total comments
    const commentsResult = await pool.query('SELECT COUNT(*) as count FROM comments WHERE status = $1', ['approved']);
    const totalComments = parseInt(commentsResult.rows[0].count);

    // Get total likes
    const likesResult = await pool.query('SELECT COUNT(*) as count FROM post_likes');
    const totalLikes = parseInt(likesResult.rows[0].count);

    // Get recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const recentCommentsResult = await pool.query(
      'SELECT COUNT(*) as count FROM comments WHERE created_at >= $1',
      [weekAgo]
    );
    const recentComments = parseInt(recentCommentsResult.rows[0].count);

    const recentLikesResult = await pool.query(
      'SELECT COUNT(*) as count FROM post_likes WHERE created_at >= $1',
      [weekAgo]
    );
    const recentLikes = parseInt(recentLikesResult.rows[0].count);

    // Get top posts by views
    const topPostsResult = await pool.query(
      'SELECT id, title, view_count, comment_count, like_count FROM posts WHERE status = $1 ORDER BY view_count DESC LIMIT 5',
      ['published']
    );
    const topPosts = topPostsResult.rows;

    res.json({
      success: true,
      stats: {
        totalPosts,
        totalViews,
        thisMonthViews,
        totalComments,
        totalLikes,
        recentComments,
        recentLikes,
        topPosts
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get detailed post analytics
export const getPostAnalytics = async (req, res) => {
  const pool = getDbPool();
  
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        title, 
        view_count, 
        comment_count, 
        like_count,
        created_at,
        published_at
      FROM posts 
      WHERE status = 'published' 
      ORDER BY view_count DESC
    `);

    res.json({
      success: true,
      posts: result.rows
    });

  } catch (error) {
    console.error('Error fetching post analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};