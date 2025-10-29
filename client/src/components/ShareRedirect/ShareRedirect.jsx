import React, { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';

/**
 * ShareRedirect Component
 * 
 * Handles shared post URLs by redirecting users to the actual post page.
 * This component is used when users click on shared links like /share/post/123
 * and redirects them to /post/123 where the actual post content is displayed.
 * 
 * Social media crawlers will be served by the backend middleware with appropriate
 * meta tags, but regular users need to be redirected to the frontend post page.
 */
const ShareRedirect = () => {
  const { postId } = useParams();

  useEffect(() => {
    // Track that this was a shared link access
    if (window.gtag) {
      window.gtag('event', 'shared_link_access', {
        event_category: 'social_sharing',
        event_label: `post_${postId}`,
        value: 1
      });
    }
  }, [postId]);

  // Redirect to the actual post page
  return <Navigate to={`/post/${postId}`} replace />;
};

export default ShareRedirect;