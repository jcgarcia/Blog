import express from 'express';
import { generateMetaTags, getPostForMeta, generateSocialPreviewPage } from '../utils/metaGenerator.js';

const router = express.Router();

/**
 * Check if request is from a social media crawler
 */
function isCrawler(userAgent) {
  if (!userAgent) return false;
  
  const crawlers = [
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot',
    'whatsapp',
    'telegrambot',
    'slackbot',
    'discordbot',
    'googlebot',
    'bingbot',
    'crawler',
    'spider',
    'bot'
  ];
  
  return crawlers.some(crawler => 
    userAgent.toLowerCase().includes(crawler)
  );
}

/**
 * Generate meta tags for homepage
 * GET /api/meta/home
 */
router.get('/home', async (req, res) => {
  try {
    const metaTags = await generateMetaTags('home', {});
    
    // If it's a crawler, return full HTML page
    if (isCrawler(req.get('User-Agent'))) {
      const htmlPage = await generateSocialPreviewPage(metaTags, 'home');
      return res.send(htmlPage);
    }
    
    // For regular requests, return JSON
    res.json({
      success: true,
      metaTags,
      type: 'home'
    });
  } catch (error) {
    console.error('Error generating home meta tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate meta tags'
    });
  }
});

/**
 * Generate meta tags for a specific post
 * GET /api/meta/post/:id
 */
router.get('/post/:id', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    
    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid post ID'
      });
    }
    
    // Get post data
    const post = await getPostForMeta(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }
    
    // Generate meta tags
    const metaTags = await generateMetaTags('post', post);
    
    // If it's a crawler, return full HTML page
    if (isCrawler(req.get('User-Agent'))) {
      const htmlPage = await generateSocialPreviewPage(metaTags, 'post', post);
      return res.send(htmlPage);
    }
    
    // For regular requests, return JSON
    res.json({
      success: true,
      metaTags,
      type: 'post',
      post: {
        id: post.id,
        title: post.title,
        excerpt: post.excerpt
      }
    });
  } catch (error) {
    console.error('Error generating post meta tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate meta tags'
    });
  }
});

/**
 * Get meta tags data for client-side rendering
 * GET /api/meta/data/post/:id
 */
router.get('/data/post/:id', async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    
    if (isNaN(postId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid post ID'
      });
    }
    
    const post = await getPostForMeta(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }
    
    // Return structured data for client-side meta tag generation
    res.json({
      success: true,
      data: {
        title: post.title,
        description: post.excerpt || post.content?.substring(0, 160),
        image: post.featured_image 
          ? (post.featured_image.startsWith('http') ? post.featured_image : `/api/media/serve/${post.featured_image}`)
          : '/favicon.ico',
        url: `/post/${post.id}`,
        author: post.author,
        datePublished: post.created_at,
        dateModified: post.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching meta data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch meta data'
    });
  }
});

/**
 * Health check endpoint
 * GET /api/meta/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Meta generation service is running',
    timestamp: new Date().toISOString()
  });
});

export default router;