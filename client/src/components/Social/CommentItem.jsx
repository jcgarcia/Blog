import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useAdmin } from '../../contexts/AdminContext';
import { API_URL } from '../../config/api';
import axios from 'axios';
import CommentForm from './CommentForm';
import './Social.css';

const CommentItem = forwardRef(({ comment, postId, onCommentUpdated, level = 0 }, ref) => {
  const { user } = useUser();
  const { adminUser, isAdmin } = useAdmin();
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [loading, setLoading] = useState(false);

  // Get current user (admin or regular user)
  const currentUser = isAdmin && adminUser ? adminUser : user;

  useImperativeHandle(ref, () => ({
    cancelReply: () => setIsReplying(false),
    cancelEdit: () => setIsEditing(false)
  }));

  const canModifyComment = () => {
    if (!currentUser) return false;
    
    // Admins can modify any comment
    if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
      return true;
    }
    
    // Users can modify their own comments
    return currentUser.id === comment.user_id;
  };

  const handleEdit = async () => {
    if (!canModifyComment() || loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      
      const response = await axios.put(`${API_URL}/api/social/comments/${comment.id}`, {
        content: editContent.trim()
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setIsEditing(false);
        onCommentUpdated && onCommentUpdated();
      }
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('Failed to edit comment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!canModifyComment() || loading) return;

    const confirmDelete = window.confirm('Are you sure you want to delete this comment?');
    if (!confirmDelete) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      
      const response = await axios.delete(`${API_URL}/api/social/comments/${comment.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        onCommentUpdated && onCommentUpdated();
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getAuthorName = () => {
    const author = comment.author || comment;
    if (author.firstName && author.lastName) {
      return `${author.firstName} ${author.lastName}`;
    } else if (author.first_name && author.last_name) {
      return `${author.first_name} ${author.last_name}`;
    } else if (author.firstName) {
      return author.firstName;
    } else if (author.first_name) {
      return author.first_name;
    } else if (author.username) {
      return author.username;
    } else if (comment.username) {
      return comment.username;
    } else {
      return 'Anonymous User';
    }
  };

  return (
    <div className={`comment-item ${level > 0 ? 'comment-reply' : ''}`}>
      <div className="comment-header">
        <div className="comment-author">
          <strong>{getAuthorName()}</strong>
          <span className="comment-date">{formatDate(comment.createdAt || comment.created_at)}</span>
          {(comment.updatedAt || comment.updated_at) !== (comment.createdAt || comment.created_at) && (
            <span className="comment-edited">(edited)</span>
          )}
        </div>
        
        {canModifyComment() && (
          <div className="comment-actions">
            <button 
              className="comment-action-btn edit-btn"
              onClick={() => setIsEditing(!isEditing)}
              disabled={loading}
              title="Edit comment"
            >
              ✏️
            </button>
            <button 
              className="comment-action-btn delete-btn"
              onClick={handleDelete}
              disabled={loading}
              title="Delete comment"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      <div className="comment-content">
        {isEditing ? (
          <div className="comment-edit-form">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              disabled={loading}
              rows={3}
              maxLength={1000}
            />
            <div className="comment-edit-actions">
              <button 
                className="cancel-button"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(comment.content);
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="save-button"
                onClick={handleEdit}
                disabled={loading || !editContent.trim()}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="comment-text">
            {comment.content}
          </div>
        )}
      </div>

      <div className="comment-footer">
        {currentUser && level < 3 && !isEditing && (
          <button 
            className="reply-button"
            onClick={() => setIsReplying(!isReplying)}
          >
            Reply
          </button>
        )}
      </div>

      {isReplying && (
        <div className="comment-reply-form">
          <CommentForm
            postId={postId}
            parentId={comment.id}
            onCommentAdded={() => {
              setIsReplying(false);
              onCommentUpdated && onCommentUpdated();
            }}
            onCancel={() => setIsReplying(false)}
          />
        </div>
      )}

      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              onCommentUpdated={onCommentUpdated}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});

CommentItem.displayName = 'CommentItem';

export default CommentItem;