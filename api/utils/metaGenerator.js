import * as db from '../db.js';
import { CoreDB } from '../services/CoreDB.js';

/**
 * Generate HTML meta tags for social media sharing
 * @param {string} type - Type of meta tags (post, home, category)
 * @param {Object} data - Data for generating meta tags
 * @param {string} baseUrl - Base URL of the site (optional, will fetch from CoreDB if not provided)
 * @returns {string} HTML meta tags
 */
export async function generateMetaTags(type, data, baseUrl = null) {
  // Get baseUrl from CoreDB if not provided
  if (!baseUrl) {
    try {
      baseUrl = await CoreDB.getConfig('meta.base_url') || 'https://bedtime.ingasti.com';
    } catch (error) {
      console.error('Error fetching baseUrl from CoreDB:', error);
      baseUrl = 'https://bedtime.ingasti.com'; // fallback
    }
  }
  let title, description, image, url, structuredData;
  
  switch (type) {
    case 'post':
      title = data.title || 'Bedtime Blog';
      description = data.excerpt || data.content?.substring(0, 160) || 'Read this interesting post on Bedtime Blog';
      image = data.featured_image 
        ? (data.featured_image.startsWith('http') ? data.featured_image : `${baseUrl}/api/media/serve/${data.featured_image}`)
        : `${baseUrl}/favicon.ico`;
      url = `${baseUrl}/post/${data.id}`;
      
      structuredData = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": title,
        "description": description,
        "image": image,
        "url": url,
        "author": {
          "@type": "Person",
          "name": data.author || "Bedtime Blog"
        },
        "publisher": {
          "@type": "Organization",
          "name": "Bedtime Blog",
          "logo": {
            "@type": "ImageObject",
            "url": `${baseUrl}/favicon.ico`
          }
        },
        "datePublished": data.created_at,
        "dateModified": data.updated_at || data.created_at
      };
      break;
      
    case 'home':
    default:
      title = 'Bedtime Blog - Your Daily Dose of Stories';
      description = 'Discover amazing stories, insights, and content on Bedtime Blog. Join our community of readers and writers.';
      image = `${baseUrl}/favicon.ico`;
      url = baseUrl;
      
      structuredData = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Bedtime Blog",
        "description": description,
        "url": url,
        "publisher": {
          "@type": "Organization",
          "name": "Bedtime Blog",
          "logo": {
            "@type": "ImageObject",
            "url": `${baseUrl}/favicon.ico`
          }
        }
      };
      break;
  }
  
  // Clean description - remove HTML tags and limit length
  description = description.replace(/<[^>]*>/g, '').substring(0, 160);
  
  return `
    <!-- Primary Meta Tags -->
    <title>${title}</title>
    <meta name="title" content="${title}" />
    <meta name="description" content="${description}" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${type === 'post' ? 'article' : 'website'}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:site_name" content="Bedtime Blog" />
    <meta property="og:locale" content="en_US" />
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${url}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${image}" />
    <meta name="twitter:site" content="@bedtimeblog" />
    
    <!-- Additional Meta Tags -->
    <meta name="author" content="${data.author || 'Bedtime Blog'}" />
    <link rel="canonical" href="${url}" />
    
    <!-- Structured Data -->
    <script type="application/ld+json">
      ${JSON.stringify(structuredData, null, 2)}
    </script>
  `.trim();
}

/**
 * Get post data for meta tag generation
 * @param {number} postId - Post ID
 * @returns {Object|null} Post data or null if not found
 */
export async function getPostForMeta(postId) {
  try {
    const pool = db.getDbPool();
    const query = `
      SELECT 
        p.id,
        p.title,
        p.content,
        p.excerpt,
        p.featured_image,
        p.created_at,
        p.updated_at,
        u.username as author
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.id = $1 AND p.status = 'published'
    `;
    
    console.log('Querying for post ID:', postId);
    const result = await pool.query(query, [postId]);
    console.log('Query result rows count:', result.rows.length);
    
    if (result.rows.length > 0) {
      console.log('Found post:', result.rows[0].title);
      return result.rows[0];
    } else {
      console.log('No post found for ID:', postId, 'with status published');
      return null;
    }
  } catch (error) {
    console.error('Error fetching post for meta tags:', error);
    return null;
  }
}

/**
 * Generate full HTML page with meta tags for crawlers
 * @param {string} metaTags - Generated meta tags HTML
 * @param {string} type - Page type (post, home)
 * @param {Object} data - Page data
 * @param {string} baseUrl - Base URL of the site (optional, will fetch from CoreDB if not provided)
 * @returns {string} Complete HTML page
 */
export async function generateSocialPreviewPage(metaTags, type, data, baseUrl = null) {
  // Get baseUrl from CoreDB if not provided
  if (!baseUrl) {
    try {
      baseUrl = await CoreDB.getConfig('meta.base_url') || 'https://bedtime.ingasti.com';
    } catch (error) {
      console.error('Error fetching baseUrl from CoreDB:', error);
      baseUrl = 'https://bedtime.ingasti.com'; // fallback
    }
  }
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- Favicon and Icons -->
  <link rel="icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" href="/favicon.ico" />
  
  ${metaTags}
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@300..700&family=Kanit:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Oswald:wght@200..700&family=Playwrite+DE+Grund:wght@100..400&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" integrity="sha512-Kc323vGBEqzTmouAECnVceyQqyqdsSiqLQISBL29aUW4U/M7pSPA/gEUZQqv1cwx4OnYxTxve5UMg5GT6L4JJg==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  
  <style>
    * { margin: 0; }
    body { 
      font-family: 'Poppins', sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .preview-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 { 
      font-family: 'Oswald', sans-serif;
      color: #333;
      margin-bottom: 20px;
    }
    .featured-image {
      width: 100%;
      max-height: 400px;
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .content {
      font-family: 'Roboto', sans-serif;
      line-height: 1.6;
      color: #666;
      margin-bottom: 20px;
    }
    .redirect-info {
      background: #e3f2fd;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #2196f3;
      margin-top: 30px;
    }
    .redirect-button {
      display: inline-block;
      background: #2196f3;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 4px;
      margin-top: 10px;
      font-weight: 500;
    }
    .redirect-button:hover {
      background: #1976d2;
    }
  </style>
  
  <!-- Auto-redirect for browsers (not crawlers) -->
  <script>
    // Only redirect if this is a real browser, not a crawler
    if (navigator.userAgent && 
        !navigator.userAgent.includes('bot') && 
        !navigator.userAgent.includes('crawler') &&
        !navigator.userAgent.includes('spider') &&
        !navigator.userAgent.includes('facebook') &&
        !navigator.userAgent.includes('twitter')) {
      setTimeout(() => {
        window.location.href = '${baseUrl}${type === 'post' ? `/post/${data?.id}` : ''}';
      }, 100);
    }
  </script>
</head>
<body>
  <div class="preview-container">
    ${type === 'post' && data ? `
      <h1>${data.title || 'Blog Post'}</h1>
      ${data.featured_image ? `
        <img src="${baseUrl}/api/media/serve/${data.featured_image}" alt="${data.title}" class="featured-image" />
      ` : ''}
      <div class="content">
        ${data.excerpt || data.content?.substring(0, 300) + '...' || 'Read this interesting post on Bedtime Blog.'}
      </div>
    ` : `
      <h1>Bedtime Blog</h1>
      <div class="content">
        Welcome to Bedtime Blog - Your daily dose of amazing stories, insights, and content. 
        Join our community of readers and writers to discover fascinating posts and engage with great content.
      </div>
    `}
    
    <div class="redirect-info">
      <strong>🔄 Redirecting to full site...</strong>
      <p>You'll be automatically redirected to the full blog experience in a moment.</p>
      <a href="${baseUrl}${type === 'post' && data ? `/post/${data.id}` : ''}" class="redirect-button">
        Continue to Bedtime Blog →
      </a>
    </div>
  </div>
</body>
</html>`;
}