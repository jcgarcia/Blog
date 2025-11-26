import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { postsAPI } from '../../config/apiService';
import { useUser } from '../../contexts/UserContext';
import { useAdmin } from '../../contexts/AdminContext';
import { API_URL } from '../../config/api';
import { markdownToHtml } from '../../utils/markdownConverter';
import LikeButton from '../Social/LikeButton';
import Comments from '../Social/Comments';
import ShareButton from '../Social/ShareButton';
import MetaTags from '../MetaTags/MetaTags';
import axios from 'axios';
import "./singlePost.css";
import PostImg from '../../media/NewPost.jpg';

export default function SinglePost() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { adminUser, isAdmin } = useAdmin();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get current user (admin or regular user)
  const currentUser = isAdmin && adminUser ? adminUser : user;

  useEffect(() => {
    if (postId) {
      fetchPost();
    }
  }, [postId]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await postsAPI.getPostById(postId);
      
      if (response.success && response.data) {
        setPost(response.data);
        // Track view after successfully loading the post
        trackView(postId);
      } else {
        setError('Post not found');
      }
    } catch (err) {
      console.error('Error fetching post:', err);
      setError('Failed to load post. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Track a view for this post
  const trackView = async (postId) => {
    try {
      await axios.post(`${API_URL}/api/views/${postId}/track`);
      // View tracking is silent - no need to show success/error to user
    } catch (error) {
      // Silently fail view tracking - don't disturb user experience
      console.log('View tracking failed (optional):', error.message);
    }
  };



  // Check if current user can edit this post
  const canEditPost = () => {
    if (!currentUser) return false;
    
    // Admins and super admins can edit any post
    if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
      return true;
    }
    
    // Editors can edit any post
    if (currentUser.role === 'editor') {
      return true;
    }
    
    // Authors/writers can edit their own posts
    if ((currentUser.role === 'author' || currentUser.role === 'writer') && post) {
      return currentUser.id === post.author_id || currentUser.username === post.username;
    }
    
    return false;
  };

  // Handle edit button click
  const handleEdit = () => {
    if (canEditPost()) {
      navigate(`/write?edit=${postId}`);
    }
  };

  // Handle delete button click
  const handleDelete = async () => {
    if (!canEditPost()) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the post "${post.title}"? This action cannot be undone.`
    );
    
    if (confirmDelete) {
      try {
        const response = await postsAPI.deletePost(postId);
        if (response.success || response.status === 200) {
          alert('Post deleted successfully!');
          // Redirect to home page after deletion
          navigate('/');
        } else {
          alert('Failed to delete post: ' + (response.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post. Please try again.');
      }
    }
  };

  // Format date to be more readable
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format author name to prioritize real name over username
  const formatAuthorName = (post) => {
    if (post.first_name && post.last_name) {
      return `${post.first_name} ${post.last_name}`;
    } else if (post.first_name) {
      return post.first_name;
    } else if (post.username) {
      return post.username;
    } else {
      return `Author ${post.author_id}` || 'Unknown';
    }
  };

  // Extract tags from available data
  const getTags = () => {
    const tags = [];
    if (post?.status) tags.push(post.status);
    if (post?.visibility) tags.push(post.visibility);
    if (post?.category_name) tags.push(post.category_name);
    return tags;
  };

  // Render content safely using our comprehensive markdown converter
  const renderContent = (content) => {
    if (!content) return { __html: 'No content available' };
    
    // Use our comprehensive markdown to HTML converter that handles images, links, etc.
    const html = markdownToHtml(content);
    
    return { __html: html };
  };

  if (loading) {
    return (
      <div className='singlePost'>
        <div className="loading">
          <p>Loading post...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='singlePost'>
        <div className="error">
          <p>{error}</p>
          <button onClick={fetchPost} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className='singlePost'>
        <div className="error">
          <p>Post not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className='singlePost'>
      <MetaTags 
        title={post.title || 'Bedtime Blog'}
        description={post.excerpt || post.meta_description || (post.content ? post.content.replace(/<[^>]*>/g, '').replace(/#+\s*/g, '').substring(0, 160) : 'Discover insightful articles and stories on our blog')}
        image={post.featured_image}
        url={window.location.href}
        type="article"
        author={formatAuthorName(post)}
        publishedTime={post.published_at || post.created_at}
        modifiedTime={post.updated_at}
        tags={post.category_name ? [post.category_name] : []}
      />
      <div className="singlePostWrapper">
          <img 
            src={post.featured_image || PostImg}
            alt={post.title || "Blog post"} 
            className="singlePostImg" 
            />
            <h1 className="singlePostTitle">
                {post.title || 'Untitled Post'}
            {canEditPost() && (
              <div className="singlePostEdit">
                <i 
                  className="SinglePostIcon fa-regular fa-pen-to-square" 
                  onClick={handleEdit}
                  title="Edit post"
                ></i>
                <i 
                  className="SinglePostIcon fa-regular fa-trash-can"
                  onClick={handleDelete}
                  title="Delete post"
                ></i>           
              </div>
            )}
            </h1>
            <div className="singlePostInfo">
                <span className='singlePostAuthor'>
                    Author: <b>{formatAuthorName(post)}</b>
                </span>
                <span className='singlePostDate'>
                  {post.published_at ? formatDate(post.published_at) : 
                   post.created_at ? formatDate(post.created_at) : 'Unknown date'}
                </span>
            </div>
            
            {/* Display tags if available */}
            {getTags().length > 0 && (
              <div className="singlePostTags">
                <strong>Tags: </strong>
                {getTags().map((tag, index) => (
                  <span key={index} className="singlePostTag">{tag}</span>
                ))}
              </div>
            )}
            
            {/* Display description if available */}
            {post.excerpt && (
              <div className="singlePostDescription">
                <p><em>{post.excerpt}</em></p>
              </div>
            )}
            
            {/* Display meta description if available */}
            {post.meta_description && post.meta_description !== post.excerpt && (
              <div className="singlePostDescription">
                <p><em>{post.meta_description}</em></p>
              </div>
            )}
            
            <div 
              className="singlePostContent"
              dangerouslySetInnerHTML={renderContent(post.content)}
            />
            
            {/* Display post stats */}
            <div className="singlePostStats">
              <span>👁️ {post.view_count || 0} views</span>
              <span>❤️ {post.like_count || 0} likes</span>
              <span>💬 {post.comment_count || 0} comments</span>
              <span>🔗 {post.share_count || 0} shares</span>
              {post.reading_time && <span>📖 {post.reading_time} min read</span>}
            </div>

            {/* Social Features */}
            <div className="social-actions">
              <LikeButton 
                postId={postId} 
                initialLikes={post.like_count || 0}
              />
              <ShareButton 
                postId={postId}
                postTitle={post.title}
                postDescription={post.excerpt || post.meta_description || (post.content ? post.content.replace(/<[^>]*>/g, '').replace(/#+\s*/g, '').substring(0, 150) + '...' : null)}
                postUrl={window.location.href}
                initialShareCount={post.share_count || 0}
                onShareCountUpdate={(count) => {
                  setPost(prev => ({ ...prev, share_count: count }));
                }}
              />
            </div>
            
            <Comments postId={postId} />
      </div>
    </div>
  );
}
