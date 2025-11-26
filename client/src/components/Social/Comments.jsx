import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config/api';
import axios from 'axios';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';
import './Social.css';

const Comments = ({ postId }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (postId) {
      fetchComments();
    }
  }, [postId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_URL}/api/social/posts/${postId}/comments`);
      
      if (response.data.success) {
        setComments(response.data.comments || []);
      } else {
        setError('Failed to load comments');
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Failed to load comments');
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCommentUpdated = () => {
    fetchComments();
  };

  // Build threaded comment structure
  const buildCommentTree = (comments) => {
    // If comments already have replies (API provides threaded structure)
    if (comments.length > 0 && comments[0].replies !== undefined) {
      return comments;
    }

    // Fallback: build tree structure manually
    const commentMap = {};
    const rootComments = [];

    // First pass: create map of all comments
    comments.forEach(comment => {
      commentMap[comment.id] = { ...comment, replies: [] };
    });

    // Second pass: organize into tree structure
    comments.forEach(comment => {
      const parentId = comment.parentId || comment.parent_id;
      if (parentId && commentMap[parentId]) {
        commentMap[parentId].replies.push(commentMap[comment.id]);
      } else {
        rootComments.push(commentMap[comment.id]);
      }
    });

    return rootComments;
  };

  const threadedComments = buildCommentTree(comments);

  if (loading) {
    return (
      <div className="comments-section">
        <div className="comments-loading">
          <p>Loading comments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="comments-section">
      <div className="comments-header">
        <h3>
          Comments ({comments.length})
        </h3>
        <button 
          className="add-comment-button"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Add Comment'}
        </button>
      </div>

      {error && (
        <div className="comments-error">
          <p>{error}</p>
          <button onClick={fetchComments} className="retry-button">
            Try Again
          </button>
        </div>
      )}

      {showForm && (
        <div className="new-comment-form">
          <CommentForm
            postId={postId}
            onCommentAdded={() => {
              setShowForm(false);
              handleCommentUpdated();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      <div className="comments-list">
        {threadedComments.length === 0 ? (
          <div className="no-comments">
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          threadedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              onCommentUpdated={handleCommentUpdated}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Comments;