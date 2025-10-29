import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config/api';
import axios from 'axios';
import './Social.css';

const ShareButton = ({ postId, postTitle, postUrl, postDescription, onShareCountUpdate, initialShareCount = 0 }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareCount, setShareCount] = useState(initialShareCount);

  // Get URLs for sharing
  const regularPostUrl = postUrl || `${window.location.origin}/post/${postId}`;
  const sharePostUrl = postId ? `${window.location.origin}/share/post/${postId}` : `${window.location.origin}/share`;
  
  // Ensure we have valid strings for encoding
  const safeTitle = postTitle && postTitle !== 'null' && postTitle !== 'undefined' ? postTitle : 'Check out this interesting post';
  const safeDescription = postDescription && postDescription !== 'null' && postDescription !== 'undefined' ? postDescription : 'Discover interesting content on our blog';
  
  // Encode content for sharing
  const encodedTitle = encodeURIComponent(safeTitle);
  const encodedShareUrl = encodeURIComponent(sharePostUrl); // Use frontend share URL for social media
  const encodedRegularUrl = encodeURIComponent(regularPostUrl); // Use regular URL for copy/native
  const encodedDescription = encodeURIComponent(safeDescription);

  // Fetch initial share count
  useEffect(() => {
    const fetchShareCount = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/social/posts/${postId}/shares`);
        if (response.data.success) {
          setShareCount(response.data.data.totalShares || 0);
        }
      } catch (error) {
        console.log('Could not fetch share count:', error);
        // Don't throw error, just use default of 0
      }
    };

    if (postId && initialShareCount === 0) {
      fetchShareCount();
    }
  }, [postId, initialShareCount]);

  // Track share analytics
  const trackShare = async (platform) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const response = await axios.post(`${API_URL}/api/social/posts/${postId}/share`, {
        platform: platform
      }, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      // Update share count
      if (response.data.shareCount) {
        setShareCount(response.data.shareCount);
        if (onShareCountUpdate) {
          onShareCountUpdate(response.data.shareCount);
        }
      }
    } catch (error) {
      console.error('Error tracking share:', error);
    }
  };

  // Share on different platforms
  const shareOnFacebook = () => {
    trackShare('facebook');
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`, '_blank');
    setShowDropdown(false);
  };

  const shareOnTwitter = () => {
    trackShare('twitter');
    window.open(`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedShareUrl}`, '_blank');
    setShowDropdown(false);
  };

  const shareOnLinkedIn = () => {
    trackShare('linkedin');
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl}`, '_blank');
    setShowDropdown(false);
  };

  const shareOnWhatsApp = () => {
    trackShare('whatsapp');
    window.open(`https://wa.me/?text=${encodedTitle}%20${encodedShareUrl}`, '_blank');
    setShowDropdown(false);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(regularPostUrl); // Use regular URL for copying
      setCopySuccess(true);
      trackShare('copy_link');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = regularPostUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
    setShowDropdown(false);
  };

  // Native sharing for mobile devices
  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: safeTitle,
          text: safeDescription,
          url: regularPostUrl, // Use regular URL for native sharing
        });
        trackShare('native');
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      setShowDropdown(!showDropdown);
    }
  };

  return (
    <div className="share-button-container">
      <button 
        className="share-button"
        onClick={shareNative}
        title="Share this post"
      >
        <span className="share-icon">🔗</span>
        <span className="share-text">{shareCount > 0 ? `${shareCount} shares` : 'Share'}</span>
      </button>

      {showDropdown && (
        <div className="share-dropdown">
          <div className="share-dropdown-content">
            <button onClick={shareOnFacebook} className="share-option facebook">
              <span className="share-option-icon">📘</span>
              <span>Facebook</span>
            </button>
            <button onClick={shareOnTwitter} className="share-option twitter">
              <span className="share-option-icon">🐦</span>
              <span>Twitter</span>
            </button>
            <button onClick={shareOnLinkedIn} className="share-option linkedin">
              <span className="share-option-icon">💼</span>
              <span>LinkedIn</span>
            </button>
            <button onClick={shareOnWhatsApp} className="share-option whatsapp">
              <span className="share-option-icon">💬</span>
              <span>WhatsApp</span>
            </button>
            <button onClick={copyToClipboard} className="share-option copy">
              <span className="share-option-icon">{copySuccess ? '✅' : '📋'}</span>
              <span>{copySuccess ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {showDropdown && (
        <div 
          className="share-dropdown-overlay" 
          onClick={() => setShowDropdown(false)}
        ></div>
      )}
    </div>
  );
};

export default ShareButton;