import { generateMetaTags, getPostForMeta, generateSocialPreviewPage } from '../utils/metaGenerator.js';
import CoreDB from '../services/CoreDB.js';

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
 * Social media crawler middleware
 * Serves HTML with proper meta tags for social media crawlers
 */
export const socialCrawlerMiddleware = async (req, res, next) => {
  const userAgent = req.get('User-Agent');
  
  console.log('Social crawler middleware called for path:', req.path);
  console.log('User agent:', userAgent);
  console.log('Is crawler:', isCrawler(userAgent));
  
  // Only handle crawler requests
  if (!isCrawler(userAgent)) {
    return next();
  }
  
  try {
    let metaTags, htmlPage;
    
    // Check if this is a post route
    const postMatch = req.path.match(/^\/share\/post\/(\d+)$/);
    console.log('Post match result:', postMatch);
    
    if (postMatch) {
      // Handle post pages
      const postId = parseInt(postMatch[1]);
      console.log('Looking for post ID:', postId);
      const post = await getPostForMeta(postId);
      console.log('Post found:', post ? post.title : 'null');
      
      if (post) {
        metaTags = await generateMetaTags('post', post);
        htmlPage = await generateSocialPreviewPage(metaTags, 'post', post);
        console.log('Generated post-specific HTML for crawler');
      } else {
        console.log('Post not found, returning 404');
        // Get base URL from CoreDB for 404 page
        let baseUrl;
        try {
          baseUrl = await CoreDB.getConfig('social.crawler_base_url') || 'https://bedtime.ingasti.com';
        } catch (error) {
          console.error('Error fetching crawler base URL from CoreDB:', error);
          baseUrl = 'https://bedtime.ingasti.com'; // fallback
        }
        
        // Post not found, serve 404
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Post Not Found - Bedtime Blog</title>
              <meta property="og:title" content="Post Not Found" />
              <meta property="og:description" content="The requested post could not be found." />
            </head>
            <body>
              <h1>Post Not Found</h1>
              <p>The requested post could not be found.</p>
              <a href="${baseUrl}">← Back to Bedtime Blog</a>
            </body>
          </html>
        `);
      }
    } else {
      console.log('No post match, serving homepage content');
      // Handle homepage and other routes
      metaTags = await generateMetaTags('home', {});
      htmlPage = await generateSocialPreviewPage(metaTags, 'home');
    }
    
    // Set proper content type and send HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlPage);
    
  } catch (error) {
    console.error('Error in social crawler middleware:', error);
    // Fallback to next middleware if error occurs
    return next();
  }
};

export default socialCrawlerMiddleware;