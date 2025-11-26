import React, { useState, useRef } from 'react';
import MediaSelector from '../MediaSelector';
import './SimpleRichTextEditor.css';

const SimpleRichTextEditor = ({ value, onChange, placeholder }) => {
  const [showMediaSelector, setShowMediaSelector] = useState(false);
  const textareaRef = useRef(null);

  const insertImageMarkdown = (imageUrl, altText) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const imageMarkdown = `![${altText || 'Image'}](${imageUrl})`;
    const newValue = value.substring(0, start) + imageMarkdown + value.substring(end);
    
    onChange(newValue);
    
    // Set cursor position after the inserted markdown
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + imageMarkdown.length, start + imageMarkdown.length);
    }, 0);
  };

  const handleImageSelect = (imageUrl) => {
    // Extract filename for alt text
    const fileName = imageUrl.split('/').pop().split('.')[0];
    insertImageMarkdown(imageUrl, fileName);
    setShowMediaSelector(false);
  };

  const insertAtCursor = (textToInsert) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const newValue = value.substring(0, start) + textToInsert + value.substring(end);
    onChange(newValue);
    
    // Set cursor position after the inserted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 0);
  };

  const formatText = (format) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText || 'bold text'}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText || 'italic text'}*`;
        break;
      case 'heading':
        formattedText = `## ${selectedText || 'Heading'}`;
        break;
      default:
        return;
    }
    
    const newValue = value.substring(0, start) + formattedText + value.substring(end);
    onChange(newValue);
    
    // Set cursor position
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start, start + formattedText.length);
      } else {
        textarea.setSelectionRange(start + formattedText.length, start + formattedText.length);
      }
    }, 0);
  };

  return (
    <div className="simple-rich-editor">
      <div className="editor-toolbar">
        <button 
          type="button" 
          onClick={() => formatText('bold')}
          className="toolbar-btn"
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button 
          type="button" 
          onClick={() => formatText('italic')}
          className="toolbar-btn"
          title="Italic"
        >
          <em>I</em>
        </button>
        <button 
          type="button" 
          onClick={() => formatText('heading')}
          className="toolbar-btn"
          title="Heading"
        >
          H2
        </button>
        <div className="toolbar-separator"></div>
        <button 
          type="button" 
          onClick={() => setShowMediaSelector(true)}
          className="toolbar-btn image-btn"
          title="Insert Image"
        >
          🖼️ Image
        </button>
      </div>
      
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="editor-textarea"
        rows="20"
      />
      
      {showMediaSelector && (
        <MediaSelector
          onSelect={handleImageSelect}
          onClose={() => setShowMediaSelector(false)}
        />
      )}
    </div>
  );
};

export default SimpleRichTextEditor;