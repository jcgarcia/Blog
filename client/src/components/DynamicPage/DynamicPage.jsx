import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { staticPagesAPI } from '../../config/apiService';
import './DynamicPage.css';

export default function DynamicPage() {
  const { slug } = useParams();
  const location = useLocation();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Get slug from URL path if not in params
  const currentSlug = slug || location.pathname.replace('/', '');

  useEffect(() => {
    loadPage();
  }, [currentSlug]);

  const loadPage = async () => {
    if (!currentSlug) return;
    
    try {
      setLoading(true);
      const response = await staticPagesAPI.getPageBySlug(currentSlug);
      
      if (response.success && response.data) {
        setPage(response.data);
      } else {
        setError('Page not found');
      }
    } catch (err) {
      console.error('Error loading page:', err);
      setError('Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (content) => {
    if (!content) return '';
    
    // Check if content is HTML (contains HTML tags)
    if (typeof content === 'string' && /<[^>]+>/.test(content)) {
      return <div dangerouslySetInnerHTML={{ __html: content }} />;
    }
    
    // Try Lexical JSON parsing
    let parsedContent;
    try {
      parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (error) {
      parsedContent = null;
    }
    
    // Lexical JSON root node
    if (parsedContent && parsedContent.root && parsedContent.root.children) {
      return renderLexicalContent(parsedContent.root);
    }
    // Lexical JSON direct root
    if (parsedContent && parsedContent.type === 'root' && parsedContent.children) {
      return renderLexicalContent(parsedContent);
    }
    // Array of nodes (rare)
    if (Array.isArray(parsedContent)) {
      return renderLexicalContent({ children: parsedContent });
    }
    // Enhanced plain text formatting fallback
    let text = typeof content === 'string' ? content : '';
    // Split into blocks by double newlines (paragraphs)
    const blocks = text.split(/\n{2,}/);
    const elements = [];
    blocks.forEach((block, i) => {
      const b = block.trim();
      if (!b) return;
      // Main title
      if (/^(Terms of Service|Privacy Policy)$/i.test(b)) {
        elements.push(<h1 key={i}>{b}</h1>);
        return;
      }
      // Last updated
      if (/^Last updated:/.test(b)) {
        elements.push(<p className="last-updated" key={i}>{b}</p>);
        return;
      }
      // Section heading (e.g., "1. Acceptance of Terms")
      if (/^\d+\.\s+.+/.test(b)) {
        elements.push(<h2 key={i}>{b}</h2>);
        return;
      }
      // Subheading (e.g., "Account Creation", "Account Responsibilities")
      if (/^[A-Z][A-Za-z ]{3,}$/.test(b) && b.length < 40) {
        elements.push(<h3 key={i}>{b}</h3>);
        return;
      }
      // Unordered list
      if (/^(- |\* )/m.test(b)) {
        const items = b.split(/\n/).filter(line => /^(- |\* )/.test(line)).map((line, idx) => <li key={idx}>{line.replace(/^(- |\* )/, '')}</li>);
        elements.push(<ul key={i}>{items}</ul>);
        return;
      }
      // Ordered list (numbered)
      if (/^(\d+\. )/m.test(b)) {
        const items = b.split(/\n/).filter(line => /^(\d+\. )/.test(line)).map((line, idx) => <li key={idx}>{line.replace(/^(\d+\. )/, '')}</li>);
        elements.push(<ol key={i}>{items}</ol>);
        return;
      }
      // Paragraph (preserve line breaks)
      const lines = b.split(/\n/);
      elements.push(
        <p key={i}>
          {lines.map((line, idx) => [line, idx < lines.length - 1 ? <br key={idx} /> : null])}
        </p>
      );
    });
    return <div>{elements}</div>;
  };

  const renderLexicalContent = (root) => {
    if (!root || !root.children) return '';
    
    return (
      <div className="lexical-content">
        {root.children.map((node, index) => renderLexicalNode(node, index))}
      </div>
    );
  };

  const renderLexicalNode = (node, index) => {
    if (!node) return null;

    switch (node.type) {
      case 'paragraph':
        // Check if this paragraph contains a header in its text
        const firstChild = node.children?.[0];
        if (firstChild && firstChild.type === 'text' && firstChild.text) {
          const text = firstChild.text;
          if (text.startsWith('## ') || text.startsWith('### ') || text.startsWith('# ')) {
            // Render as header instead of paragraph
            return renderLexicalNode(firstChild, index);
          }
        }
        
        return (
          <p key={index}>
            {node.children?.map((child, childIndex) => renderLexicalNode(child, childIndex))}
          </p>
        );
      
      case 'heading':
        const HeadingTag = `h${node.tag}`;
        return React.createElement(
          HeadingTag,
          { key: index },
          node.children?.map((child, childIndex) => renderLexicalNode(child, childIndex))
        );
      
      case 'text':
        let text = node.text || '';
        
        // Handle Markdown formatting within text nodes
        if (text.startsWith('## ')) {
          return <h2 key={index}>{text.replace(/^## /, '')}</h2>;
        }
        if (text.startsWith('### ')) {
          return <h3 key={index}>{text.replace(/^### /, '')}</h3>;
        }
        if (text.startsWith('# ')) {
          return <h1 key={index}>{text.replace(/^# /, '')}</h1>;
        }
        
        // Handle bold text with **text**
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Handle italic text with *text*
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Handle lists
        if (text.includes('- ') || text.includes('* ')) {
          const listItems = text.split('\n').filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* '));
          if (listItems.length > 0) {
            return (
              <ul key={index}>
                {listItems.map((item, idx) => (
                  <li key={idx} dangerouslySetInnerHTML={{ __html: item.replace(/^[- \*] /, '') }} />
                ))}
              </ul>
            );
          }
        }
        
        let textElement = text;
        
        // Apply Lexical formatting
        if (node.format && node.format > 0) {
          if (node.format & 1) textElement = <strong key={index}>{textElement}</strong>; // Bold
          if (node.format & 2) textElement = <em key={index}>{textElement}</em>; // Italic
          if (node.format & 8) textElement = <u key={index}>{textElement}</u>; // Underline
        } else if (text.includes('<strong>') || text.includes('<em>')) {
          // If we have HTML from markdown conversion, render it
          return <span key={index} dangerouslySetInnerHTML={{ __html: textElement }} />;
        }
        
        return textElement;
      
      case 'list':
        const ListTag = node.listType === 'number' ? 'ol' : 'ul';
        return React.createElement(
          ListTag,
          { key: index },
          node.children?.map((child, childIndex) => renderLexicalNode(child, childIndex))
        );
      
      case 'listitem':
        return (
          <li key={index}>
            {node.children?.map((child, childIndex) => renderLexicalNode(child, childIndex))}
          </li>
        );
      
      case 'quote':
        return (
          <blockquote key={index}>
            {node.children?.map((child, childIndex) => renderLexicalNode(child, childIndex))}
          </blockquote>
        );
      
      default:
        // For unknown node types, try to render children
        if (node.children) {
          return (
            <div key={index}>
              {node.children.map((child, childIndex) => renderLexicalNode(child, childIndex))}
            </div>
          );
        }
        return null;
    }
  };

  if (loading) {
    return (
      <div className="dynamic-page-loading">
        <div className="loading-spinner"></div>
        <p>Loading page...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dynamic-page-error">
        <h1>Page Not Found</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="dynamic-page-error">
        <h1>Page Not Found</h1>
        <p>The requested page could not be found.</p>
      </div>
    );
  }

  return (
    <div className="dynamic-page">
      <div className="dynamic-page-content">
        <h1>{page.title}</h1>
        {page.updated_at && (
          <p className="last-updated">
            Last updated: {new Date(page.updated_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        )}
        <div className="page-content">
          {renderContent(page.content)}
        </div>
      </div>
    </div>
  );
}
