import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useAdmin } from '../../contexts/AdminContext';
import { API_URL } from '../../config/api';
import axios from 'axios';
import './Social.css';

const CommentForm = ({ postId, parentId = null, onCommentAdded, onCancel }) => {
  const { user } = useUser();
  const { adminUser, isAdmin } = useAdmin();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  // Get current user (admin or regular user)
  const currentUser = isAdmin && adminUser ? adminUser : user;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !content.trim() || loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      
      const url = parentId 
        ? `${API_URL}/api/social/comments/${parentId}/reply`
        : `${API_URL}/api/social/posts/${postId}/comments`;
      
      const payload = parentId 
        ? { postId: parseInt(postId), content: content.trim() }
        : { content: content.trim() };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setContent('');
        onCommentAdded && onCommentAdded();
        onCancel && onCancel();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      if (error.response?.status === 401) {
        alert('Please log in to comment');
      } else {
        alert('Failed to add comment. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="comment-form-placeholder">
        <p>Please log in to leave a comment</p>
      </div>
    );
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <div className="comment-form-header">
        <span className="commenting-as">
          Commenting as <strong>{currentUser.username || currentUser.first_name || 'User'}</strong>
        </span>
      </div>
      
      <textarea
        className="comment-textarea"
        placeholder={parentId ? "Write a reply..." : "Write a comment..."}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={loading}
        rows={3}
        maxLength={1000}
      />
      
      <div className="comment-form-actions">
        <div className="character-count">
          {content.length}/1000
        </div>
        <div className="form-buttons">
          {parentId && (
            <button 
              type="button" 
              className="cancel-button"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button 
            type="submit" 
            className="submit-button"
            disabled={!content.trim() || loading}
          >
            {loading ? 'Posting...' : (parentId ? 'Reply' : 'Comment')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default CommentForm;