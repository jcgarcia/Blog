import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useAdmin } from '../../contexts/AdminContext';
import { API_URL } from '../../config/api';
import axios from 'axios';
import './Social.css';

const LikeButton = ({ postId, initialLikes = 0, initialUserHasLiked = false }) => {
  const { user } = useUser();
  const { adminUser, isAdmin } = useAdmin();
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [userHasLiked, setUserHasLiked] = useState(initialUserHasLiked);
  const [loading, setLoading] = useState(false);

  // Get current user (admin or regular user)
  const currentUser = isAdmin && adminUser ? adminUser : user;

  useEffect(() => {
    fetchLikes();
  }, [postId]);

  const fetchLikes = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/likes/${postId}`);
      setLikeCount(response.data.likes);
      setUserHasLiked(response.data.userHasLiked || false);
    } catch (error) {
      console.error('Error fetching likes:', error);
      setLikeCount(initialLikes);
      setUserHasLiked(initialUserHasLiked);
    }
  };

  const handleLikeToggle = async () => {
    if (!currentUser || loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      
      const response = await axios.post(`${API_URL}/api/likes/${postId}/toggle`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setLikeCount(response.data.likeCount);
        setUserHasLiked(response.data.liked);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      if (error.response?.status === 401) {
        alert('Please log in to like posts');
      } else {
        alert('Failed to update like. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="like-button-container">
      <button 
        className={`like-button ${userHasLiked ? 'liked' : ''} ${loading ? 'loading' : ''}`}
        onClick={handleLikeToggle}
        disabled={!currentUser || loading}
        title={currentUser ? (userHasLiked ? 'Unlike this post' : 'Like this post') : 'Please log in to like posts'}
      >
        <span className="like-icon">
          {userHasLiked ? '❤️' : '🤍'}
        </span>
        <span className="like-text">
          {userHasLiked ? 'Liked' : 'Like'}
        </span>
      </button>
      <span className="like-count">
        {likeCount} {likeCount === 1 ? 'like' : 'likes'}
      </span>
    </div>
  );
};

export default LikeButton;