import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import Post from '../post/Post'
import { postsAPI } from '../../config/apiService'
import './posts.css'

export default function Posts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { categoryName } = useParams();
  const location = useLocation();

  // Reset posts when category changes
  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    fetchPosts(1);
  }, [categoryName, location.pathname]);

  const fetchPosts = async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await postsAPI.getAllPosts(pageNum, 10, categoryName);
      
      if (response.success) {
        if (pageNum === 1) {
          setPosts(response.data);
        } else {
          setPosts(prev => [...prev, ...response.data]);
        }
        
        // Check if there are more posts to load
        setHasMore(response.data.length === 10);
      } else {
        setError('Failed to fetch posts');
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Failed to load posts. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const loadMorePosts = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage);
    }
  };

  if (loading && posts.length === 0) {
    return (
      <div className='posts'>
        <div className="loading">
          <p>Loading posts...</p>
        </div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className='posts'>
        <div className="error">
          <p>{error}</p>
          <button onClick={() => fetchPosts(1)} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='posts'>
      {categoryName && (
        <div className="category-header">
          <h2>Posts in "{categoryName}" Category</h2>
          <p>Showing all posts tagged with {categoryName}</p>
        </div>
      )}
      
      {posts.length > 0 ? (
        <>
          {posts.map((post) => (
            <Post key={post.id} post={post} />
          ))}
          
          {hasMore && (
            <div className="load-more">
              <button 
                onClick={loadMorePosts} 
                disabled={loading}
                className="load-more-btn"
              >
                {loading ? 'Loading...' : 'Load More Posts'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="no-posts">
          <p>{categoryName ? `No posts found in "${categoryName}" category.` : 'No posts available yet.'}</p>
        </div>
      )}
      
      {error && (
        <div className="error-notice">
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}
