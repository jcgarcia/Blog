import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { postsAPI } from '../../services/postsAPI';
import './search.css';

export default function Search({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Truncate text helper
  const truncateText = (text, maxLength = 150) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
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
      return 'Unknown';
    }
  };

  // Close search on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Focus on search input when opened
      const searchInput = document.querySelector('.search-input');
      if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Search function - now uses real API
  const performSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError('');
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setSearchError('');

    try {
      const response = await postsAPI.searchPosts(query);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Failed to search posts. Please try again.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  // Handle search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  if (!isOpen) return null;

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-container" onClick={(e) => e.stopPropagation()}>
        <div className="search-header">
          <h2>
            <i className="fa-solid fa-magnifying-glass"></i>
            Search Blog
          </h2>
          <button className="search-close" onClick={onClose}>
            <i className="fa-solid fa-times"></i>
          </button>
        </div>

        <form className="search-form" onSubmit={handleSearchSubmit}>
          <div className="search-input-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search posts, topics, or keywords..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            <button type="submit" className="search-submit">
              <i className="fa-solid fa-search"></i>
            </button>
          </div>
        </form>

        <div className="search-results">
          {isLoading && (
            <div className="search-loading">
              <div className="loading-spinner"></div>
              <p>Searching...</p>
            </div>
          )}

          {!isLoading && searchError && (
            <div className="search-error">
              <i className="fa-solid fa-exclamation-triangle"></i>
              <h3>Search Error</h3>
              <p>{searchError}</p>
            </div>
          )}

          {!isLoading && hasSearched && searchResults.length === 0 && !searchError && (
            <div className="search-no-results">
              <i className="fa-solid fa-search-minus"></i>
              <h3>No results found</h3>
              <p>Try different keywords or check your spelling</p>
            </div>
          )}

          {!isLoading && searchResults.length > 0 && (
            <div className="search-results-list">
              <h3>Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</h3>
              {searchResults.map(post => (
                <Link 
                  key={post.id} 
                  to={`/post/${post.id}`} 
                  className="search-result-item"
                  onClick={onClose}
                >
                  <div className="search-result-content">
                    <h4>{post.title}</h4>
                    <p>{truncateText(post.excerpt || post.content)}</p>
                    <div className="search-result-meta">
                      <span className="search-result-date">
                        <i className="fa-solid fa-calendar"></i>
                        {formatDate(post.created_at)}
                      </span>
                      <span className="search-result-category">
                        <i className="fa-solid fa-tag"></i>
                        {post.category_name || 'Uncategorized'}
                      </span>
                      <span className="search-result-author">
                        <i className="fa-solid fa-user"></i>
                        {formatAuthorName(post)}
                      </span>
                    </div>
                  </div>
                  <div className="search-result-icon">
                    <i className="fa-solid fa-arrow-right"></i>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!hasSearched && (
            <div className="search-suggestions">
              <h3>Search Tips</h3>
              <div className="search-tips">
                <p><strong>✨ Try searching for:</strong></p>
                <ul>
                  <li>Post titles or keywords</li>
                  <li>Topics you're interested in</li>
                  <li>Author names</li>
                  <li>Content snippets</li>
                </ul>
              </div>
              <div className="search-tags">
                <button 
                  className="search-tag" 
                  onClick={() => {
                    setSearchQuery('tutorial');
                    performSearch('tutorial');
                  }}
                >
                  Tutorial
                </button>
                <button 
                  className="search-tag" 
                  onClick={() => {
                    setSearchQuery('guide');
                    performSearch('guide');
                  }}
                >
                  Guide
                </button>
                <button 
                  className="search-tag" 
                  onClick={() => {
                    setSearchQuery('tips');
                    performSearch('tips');
                  }}
                >
                  Tips
                </button>
                <button 
                  className="search-tag" 
                  onClick={() => {
                    setSearchQuery('development');
                    performSearch('development');
                  }}
                >
                  Development
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
