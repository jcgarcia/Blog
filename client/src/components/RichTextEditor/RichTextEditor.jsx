import React, { useState, useRef, useEffect } from 'react';
import MediaSelector from '../MediaSelector';
import { markdownToHtml, htmlToMarkdown } from '../../utils/markdownConverter';
import './RichTextEditor.css';

export default function RichTextEditor({ value, onChange, placeholder = "Write your post..." }) {
  const [showMediaSelector, setShowMediaSelector] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageControls, setImageControls] = useState({ show: false, x: 0, y: 0 });
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current) {
      // Convert markdown to HTML for WYSIWYG display
      const htmlContent = markdownToHtml(value || '');
      if (htmlContent !== editorRef.current.innerHTML) {
        editorRef.current.innerHTML = htmlContent;
        
        // Restore image sizes from data-size attributes
        const images = editorRef.current.querySelectorAll('img[data-size]');
        images.forEach(img => {
          const size = img.getAttribute('data-size');
          let width, maxWidth;
          switch (size) {
            case 'small':
              width = '300px';
              maxWidth = '300px';
              break;
            case 'medium':
              width = '500px';
              maxWidth = '500px';
              break;
            case 'large':
            default:
              width = '100%';
              maxWidth = '100%';
              break;
          }
          img.style.width = width;
          img.style.maxWidth = maxWidth;
          img.style.height = 'auto';
        });
      }
    }
  }, [value]);

  useEffect(() => {
    // Add click listener to detect clicks outside images
    const handleClickOutside = (e) => {
      if (!e.target.tagName || e.target.tagName !== 'IMG') {
        setSelectedImage(null);
        setImageControls({ show: false, x: 0, y: 0 });
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      // Convert HTML back to markdown for storage
      const markdownContent = htmlToMarkdown(editorRef.current.innerHTML);
      onChange(markdownContent);
      
      // Re-attach click handlers to all images after content change
      setTimeout(() => {
        const images = editorRef.current.querySelectorAll('img');
        images.forEach(img => {
          // Remove existing listeners to prevent duplicates
          img.onclick = null;
          // Add new listener
          img.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleImageClick(e, img);
          };
        });
      }, 50);
    }
  };

  const formatText = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current.focus();
    handleInput();
  };

  const insertImage = (imageUrl) => {
    console.log('RichTextEditor: Received imageUrl:', imageUrl);
    if (editorRef.current) {
      // Focus the editor first
      editorRef.current.focus();
      
      // Insert image at cursor position with unique ID for management
      const imageId = 'img_' + Date.now();
      const img = `<img id="${imageId}" src="${imageUrl}" alt="Image" data-size="large" style="max-width: 100%; height: auto; margin: 10px 0; cursor: pointer;" onclick="event.stopPropagation();" />`;
      console.log('RichTextEditor: Inserting HTML:', img);
      formatText('insertHTML', img);
      
      // Add click handler to the newly inserted image
      setTimeout(() => {
        const insertedImg = editorRef.current.querySelector(`#${imageId}`);
        if (insertedImg) {
          insertedImg.addEventListener('click', (e) => handleImageClick(e, insertedImg));
        }
      }, 100);
    }
    setShowMediaSelector(false);
  };

  const handleImageClick = (e, img) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSelectedImage(img);
    
    // Position controls near the image
    const rect = img.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    
    setImageControls({
      show: true,
      x: rect.right - editorRect.left - 100, // Position to the right of image
      y: rect.top - editorRect.top
    });
  };

  const resizeImage = (size) => {
    if (selectedImage) {
      let width, maxWidth;
      switch (size) {
        case 'small':
          width = '300px';
          maxWidth = '300px';
          break;
        case 'medium':
          width = '500px';
          maxWidth = '500px';
          break;
        case 'large':
          width = '100%';
          maxWidth = '100%';
          break;
        default:
          width = '100%';
          maxWidth = '100%';
      }
      
      selectedImage.style.width = width;
      selectedImage.style.maxWidth = maxWidth;
      selectedImage.style.height = 'auto';
      selectedImage.setAttribute('data-size', size); // Preserve size info
      
      handleInput(); // Update the content
      setImageControls({ show: false, x: 0, y: 0 });
      setSelectedImage(null);
    }
  };

  const deleteImage = () => {
    if (selectedImage) {
      selectedImage.remove();
      handleInput(); // Update the content
      setImageControls({ show: false, x: 0, y: 0 });
      setSelectedImage(null);
    }
  };

  const handleKeyDown = (e) => {
    // Handle common keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          formatText('bold');
          break;
        case 'i':
          e.preventDefault();
          formatText('italic');
          break;
        case 'u':
          e.preventDefault();
          formatText('underline');
          break;
      }
    }
  };

  return (
    <div className="rich-text-editor">
      <div className="editor-toolbar">
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => formatText('bold')}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => formatText('italic')}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => formatText('underline')}
          title="Underline (Ctrl+U)"
        >
          <u>U</u>
        </button>
        
        <div className="toolbar-separator"></div>
        
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => formatText('formatBlock', 'h1')}
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => formatText('formatBlock', 'h2')}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => formatText('formatBlock', 'h3')}
          title="Heading 3"
        >
          H3
        </button>
        
        <div className="toolbar-separator"></div>
        
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => formatText('insertUnorderedList')}
          title="Bullet List"
        >
          •
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => formatText('insertOrderedList')}
          title="Numbered List"
        >
          1.
        </button>
        
        <div className="toolbar-separator"></div>
        
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => setShowMediaSelector(true)}
          title="Insert Image"
        >
          🖼️
        </button>
        
        <div className="toolbar-separator"></div>
        
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => formatText('removeFormat')}
          title="Clear Formatting"
        >
          ✕
        </button>
      </div>

      <div className="editor-container" style={{ position: 'relative' }}>
        <div
          ref={editorRef}
          className="editor-content"
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onClick={(e) => {
            if (e.target.tagName === 'IMG') {
              handleImageClick(e, e.target);
            }
          }}
          suppressContentEditableWarning={true}
          style={{
            minHeight: '400px',
            padding: '15px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: '-apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
            outline: 'none',
            backgroundColor: '#fff'
          }}
          data-placeholder={placeholder}
        />

        {/* Image Controls Popup */}
        {imageControls.show && (
          <div 
            className="image-controls-popup"
            style={{
              position: 'absolute',
              top: `${imageControls.y}px`,
              left: `${imageControls.x}px`,
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              minWidth: '120px'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>
              Resize Image:
            </div>
            <button
              className="image-control-btn"
              onClick={() => resizeImage('small')}
              style={{
                padding: '4px 8px',
                border: '1px solid #ddd',
                borderRadius: '3px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Small (300px)
            </button>
            <button
              className="image-control-btn"
              onClick={() => resizeImage('medium')}
              style={{
                padding: '4px 8px',
                border: '1px solid #ddd',
                borderRadius: '3px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Medium (500px)
            </button>
            <button
              className="image-control-btn"
              onClick={() => resizeImage('large')}
              style={{
                padding: '4px 8px',
                border: '1px solid #ddd',
                borderRadius: '3px',
                background: 'white',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Large (100%)
            </button>
            <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #eee' }} />
            <button
              className="image-control-btn delete-btn"
              onClick={deleteImage}
              style={{
                padding: '4px 8px',
                border: '1px solid #dc3545',
                borderRadius: '3px',
                background: '#dc3545',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🗑️ Delete Image
            </button>
          </div>
        )}
      </div>

      {showMediaSelector && (
        <MediaSelector
          onSelect={insertImage}
          onClose={() => setShowMediaSelector(false)}
          title="Insert Image"
        />
      )}
    </div>
  );
}
