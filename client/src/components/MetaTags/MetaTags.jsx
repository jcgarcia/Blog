import React from 'react';
import { Helmet } from 'react-helmet-async';

const MetaTags = ({ 
  title = 'Bedtime Blog', 
  description = 'Discover insightful articles and stories on our blog', 
  image = null, 
  url = window.location.href,
  type = 'website',
  author = 'Bedtime Blog',
  publishedTime = null,
  modifiedTime = null,
  tags = []
}) => {
  // Ensure we have absolute URLs
  const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
  
  // For social sharing, use featured image if available, otherwise use a default blog image
  const defaultImage = `${window.location.origin}/favicon.ico`;
  const absoluteImage = image 
    ? (image.startsWith('http') ? image : `${window.location.origin}${image}`)
    : defaultImage;
  
  // Clean up description (remove HTML tags, limit length)
  const cleanDescription = description
    ? description.replace(/<[^>]*>/g, '').replace(/#+\s*/g, '').substring(0, 160)
    : 'Discover insightful articles and stories on our blog';

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={cleanDescription} />
      {author && <meta name="author" content={author} />}
      {tags.length > 0 && <meta name="keywords" content={tags.join(', ')} />}
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={cleanDescription} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:url" content={absoluteUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Bedtime Blog" />
      <meta property="og:locale" content="en_US" />
      
      {/* Article specific meta tags */}
      {type === 'article' && (
        <>
          {publishedTime && <meta property="article:published_time" content={publishedTime} />}
          {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
          {author && <meta property="article:author" content={author} />}
          {tags.map(tag => (
            <meta key={tag} property="article:tag" content={tag} />
          ))}
        </>
      )}
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={cleanDescription} />
      <meta name="twitter:image" content={absoluteImage} />
      <meta name="twitter:site" content="@bedtimeblog" />
      <meta name="twitter:creator" content="@bedtimeblog" />
      
      {/* Additional SEO Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <link rel="canonical" href={absoluteUrl} />
      
      {/* Structured Data for Articles */}
      {type === 'article' && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": title,
            "description": cleanDescription,
            "image": absoluteImage,
            "url": absoluteUrl,
            "author": {
              "@type": "Person",
              "name": author
            },
            "publisher": {
              "@type": "Organization",
              "name": "Bedtime Blog",
              "logo": {
                "@type": "ImageObject",
                "url": `${window.location.origin}/favicon.ico`
              }
            },
            "datePublished": publishedTime,
            "dateModified": modifiedTime || publishedTime
          })}
        </script>
      )}
    </Helmet>
  );
};

export default MetaTags;