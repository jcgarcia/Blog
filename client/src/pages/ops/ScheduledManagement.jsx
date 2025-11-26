import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '../../services/postsAPI';
import './DraftManagement.css';

export default function ScheduledManagement() {
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchScheduledPosts();
  }, []);

  const fetchScheduledPosts = async () => {
    try {
      setLoading(true);
      const response = await postsAPI.getScheduledPosts();
      setScheduledPosts(response.data || []);
    } catch (error) {
      console.error('Error fetching scheduled posts:', error);
      setError('Failed to fetch scheduled posts');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (postId) => {
    navigate(`/write?edit=${postId}`);
  };

  const handleDelete = async (post) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the scheduled post "${post.title}"? This action cannot be undone.`
    );
    
    if (confirmDelete) {
      try {
        const response = await postsAPI.deletePost(post.id);
        if (response.status === 200 || response.data?.success) {
          alert('Scheduled post deleted successfully!');
          // Refresh the list
          fetchScheduledPosts();
        } else {
          alert('Failed to delete scheduled post: ' + (response.data?.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error deleting scheduled post:', error);
        alert('Failed to delete scheduled post. Please try again.');
      }
    }
  };

  const handlePublishNow = async (post) => {
    const confirmPublish = window.confirm(
      `Are you sure you want to publish "${post.title}" immediately?`
    );
    
    if (confirmPublish) {
      try {
        // Update post status to published and set published_at to now
        const updateData = {
          title: post.title,
          content: post.content,
          status: 'published',
          published_at: new Date().toISOString()
        };
        
        const response = await postsAPI.updatePost(post.id, updateData);
        if (response.data?.success || response.status === 200) {
          alert('Post published successfully!');
          // Refresh the list
          fetchScheduledPosts();
        } else {
          alert('Failed to publish post: ' + (response.data?.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error publishing post:', error);
        alert('Failed to publish post. Please try again.');
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOverdue = (publishedAt) => {
    return publishedAt && new Date(publishedAt) < new Date();
  };

  if (loading) {
    return (
      <div className="draft-management">
        <div className="loading">Loading scheduled posts...</div>
      </div>
    );
  }

  return (
    <div className="draft-management">
      <div className="header">
        <h1>Scheduled Posts</h1>
        <button className="btn-secondary" onClick={() => navigate('/ops')}>
          ← Back to Content Management
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {scheduledPosts.length === 0 ? (
        <div className="empty-state">
          <h3>No Scheduled Posts Found</h3>
          <p>You don't have any posts scheduled for future publication.</p>
          <button className="btn-primary" onClick={() => navigate('/write')}>
            Create New Post
          </button>
        </div>
      ) : (
        <div className="drafts-table">
          <h2>Scheduled Posts ({scheduledPosts.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Scheduled For</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scheduledPosts.map((post) => (
                <tr key={post.id} className={isOverdue(post.published_at) ? 'overdue' : ''}>
                  <td>
                    <div className="post-title">{post.title}</div>
                    <div className="post-excerpt">
                      {post.content ? post.content.substring(0, 100) + '...' : 'No content'}
                    </div>
                  </td>
                  <td>{post.category_name || 'Uncategorized'}</td>
                  <td>
                    <strong>{formatDate(post.published_at)}</strong>
                    {isOverdue(post.published_at) && (
                      <div style={{color: '#d32f2f', fontSize: '0.85em'}}>⚠️ Overdue</div>
                    )}
                  </td>
                  <td>
                    <span className="status-badge status-scheduled">Scheduled</span>
                  </td>
                  <td>
                    <div className="actions">
                      <button 
                        className="btn-edit"
                        onClick={() => handleEdit(post.id)}
                        title="Edit scheduled post"
                      >
                        Edit
                      </button>
                      <button 
                        className="btn-publish"
                        onClick={() => handlePublishNow(post)}
                        title="Publish immediately"
                      >
                        Publish Now
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDelete(post)}
                        title="Delete scheduled post"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
