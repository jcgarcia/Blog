import React, { useState, useEffect } from 'react';
import './MediaSelector.css';

const MediaSelector = ({ onSelect, selectedImage, onClose, title = "Select Featured Image" }) => {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    fetchMedia();
  }, [pagination.page]);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('adminToken') || localStorage.getItem('userToken');
      
      if (!token) {
        setError('Authentication required. Please log in to access media library.');
        return;
      }
      
      console.log('MediaSelector: Fetching media with token:', token.substring(0, 20) + '...');
      
      // Fetch media files with pagination
      const params = new URLSearchParams({
        folder: '/',
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });
      
      const mediaUrl = `https://bapi.ingasti.com/api/media/files?${params}`;
      
      const response = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('MediaSelector: API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('MediaSelector: API response data:', data);
      
      if (data.success && data.media && Array.isArray(data.media)) {
        // Filter only image files and add them with proper URLs
        const imageFiles = data.media.filter(item => {
          const isImage = item.mime_type && item.mime_type.startsWith('image/');
          const hasImageExtension = (item.filename || item.file_name || item.original_name)?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
          return isImage || hasImageExtension;
        }).map(item => ({
          ...item,
          // Preserve both original_name for display and filename for serving
          display_name: item.original_name || item.file_name || item.filename,
          filename: item.filename || item.file_name,
          public_url: item.public_url || item.signed_url || item.url
        }));
        
        console.log('MediaSelector: Filtered image files:', imageFiles.length);
        setMedia(imageFiles);
        setPagination(data.pagination || pagination);
      } else {
        console.log('MediaSelector: No media found in response');
        setMedia([]);
      }
    } catch (err) {
      console.error('MediaSelector: Error fetching media:', err);
      setError(`Failed to load media: ${err.message}. Please make sure you're logged in.`);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (image) => {
    setSelectedItem(image);
  };

  const handleInsert = () => {
    if (selectedItem) {
      // Always use the permanent media serving endpoint to avoid URL expiration
      let imageUrl;
      
      // Use the actual filename from database (not original_name)
      const actualFilename = selectedItem.filename || selectedItem.file_name;
      
      if (actualFilename) {
        // Use the media serving endpoint for permanent URLs
        imageUrl = `https://bapi.ingasti.com/api/media/serve/${actualFilename}`;
      } else if (selectedItem.public_url && !selectedItem.public_url.includes('PRIVATE_BUCKET') && !selectedItem.public_url.includes('X-Amz-')) {
        // Only use public_url if it's not a signed URL (doesn't contain X-Amz-)
        imageUrl = selectedItem.public_url;
      } else {
        // Fallback to s3_key if we have it
        imageUrl = selectedItem.s3_key || selectedItem.file_path;
      }
      
      console.log('MediaSelector: Selected item:', selectedItem);
      console.log('MediaSelector: Generated URL:', imageUrl);
      console.log('MediaSelector: Calling onSelect with URL:', imageUrl);
      
      onSelect(imageUrl);
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="media-selector-overlay">
        <div className="media-selector-modal">
          <div className="media-selector-header">
            <h3>{title}</h3>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="media-selector-loading">Loading media...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="media-selector-overlay">
        <div className="media-selector-modal">
          <div className="media-selector-header">
            <h3>{title}</h3>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="media-selector-error">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="media-selector-overlay">
      <div className="media-selector-modal">
        <div className="media-selector-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="media-selector-content">
          {media.length === 0 ? (
            <div className="no-media">No images available. Upload images in the Operations Panel first.</div>
          ) : (
            <div className="media-grid">
              {media.map((item, index) => (
                <div 
                  key={index} 
                  className={`media-item ${selectedItem === item ? 'selected' : ''}`}
                  onClick={() => handleImageClick(item)}
                >
                  <img 
                    src={item.public_url} 
                    alt={item.display_name}
                    className="media-thumbnail"
                  />
                  <div className="media-info">
                    <div className="media-name">{item.display_name}</div>
                    <div className="media-details">
                      {item.file_size && <span className="media-size">{item.file_size}</span>}
                      {item.file_type && <span className="media-type">{item.file_type}</span>}
                    </div>
                  </div>
                  {selectedItem === item && (
                    <div className="selection-indicator">
                      <span className="checkmark">✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="media-selector-footer">
          <div className="selection-info">
            {selectedItem ? (
              <span>Selected: {selectedItem.display_name}</span>
            ) : (
              <span>Click an image to select it</span>
            )}
          </div>
          
          {/* Pagination controls */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button 
                className="btn-secondary"
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <button 
                className="btn-secondary"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </button>
            </div>
          )}
          
          <div className="footer-buttons">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button 
              className="btn-primary" 
              onClick={handleInsert}
              disabled={!selectedItem}
            >
              Insert Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaSelector;
