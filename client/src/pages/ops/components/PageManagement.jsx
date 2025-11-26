import React, { useState, useEffect } from 'react';
import { staticPagesAPI } from '../../../config/apiService';

export default function PageManagement() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const response = await staticPagesAPI.getAllPages();
      if (response.success) {
        setPages(response.data);
      } else {
        setMessage('Error loading pages');
      }
    } catch (error) {
      console.error('Error fetching pages:', error);
      setMessage('Error loading pages');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePage = async (pageId, pageTitle) => {
    if (window.confirm(`Are you sure you want to delete the page "${pageTitle}"?`)) {
      try {
        const response = await staticPagesAPI.deletePage(pageId);
        if (response.success) {
          setPages(pages.filter(page => page.id !== pageId));
          setMessage('Page deleted successfully!');
          setTimeout(() => setMessage(''), 3000);
        } else {
          setMessage('Error deleting page');
        }
      } catch (error) {
        console.error('Error deleting page:', error);
        setMessage('Error deleting page');
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#27ae60';
      case 'inactive': return '#e74c3c';
      case 'draft': return '#f39c12';
      default: return '#95a5a6';
    }
  };

  if (loading) {
    return (
      <div className="page-management">
        <div className="loading">Loading pages...</div>
      </div>
    );
  }

  return (
    <div className="page-management">
      <div className="section-header">
        <h2>Static Page Management</h2>
        <a href="/edit-page" className="btn-primary">
          <i className="fa-solid fa-plus"></i> Create New Page
        </a>
      </div>

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="pages-grid">
        <div className="page-card quick-actions">
          <h3>Quick Actions</h3>
          <div className="quick-buttons">
            <a href="/edit-page?slug=about" className="btn-secondary">
              <i className="fa-solid fa-info-circle"></i> Edit About
            </a>
            <a href="/edit-page?slug=privacy" className="btn-secondary">
              <i className="fa-solid fa-shield-alt"></i> Edit Privacy
            </a>
            <a href="/edit-page?slug=terms" className="btn-secondary">
              <i className="fa-solid fa-file-contract"></i> Edit Terms
            </a>
            <a href="/edit-page" className="btn-primary">
              <i className="fa-solid fa-plus"></i> New Page
            </a>
          </div>
        </div>

        {pages.map(page => (
          <div key={page.id} className="page-card">
            <div className="page-header">
              <h3>{page.title}</h3>
              <span 
                className="page-status" 
                style={{ backgroundColor: getStatusColor(page.status) }}
              >
                {page.status}
              </span>
            </div>
            <div className="page-info">
              <p className="page-slug">
                <i className="fa-solid fa-link"></i> /{page.slug}
              </p>
              <p className="page-template">
                <i className="fa-solid fa-layout"></i> Template: {page.template}
              </p>
              <p className="page-meta">
                <i className="fa-solid fa-calendar"></i> 
                Updated: {formatDate(page.updated_at)}
              </p>
              {page.meta_title && (
                <p className="page-seo">
                  <i className="fa-solid fa-search"></i> SEO optimized
                </p>
              )}
              {page.show_in_menu && (
                <p className="page-menu">
                  <i className="fa-solid fa-bars"></i> Shown in menu
                </p>
              )}
            </div>
            <div className="page-actions">
              <a 
                href={`/edit-page?id=${page.id}`}
                className="btn-secondary"
              >
                <i className="fa-solid fa-edit"></i> Edit
              </a>
              <a 
                href={`/${page.slug}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                <i className="fa-solid fa-external-link-alt"></i> View
              </a>
              <button 
                className="btn-danger"
                onClick={() => handleDeletePage(page.id, page.title)}
              >
                <i className="fa-solid fa-trash"></i> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {pages.length === 0 && (
        <div className="no-pages">
          <i className="fa-solid fa-file-text"></i>
          <h3>No static pages found</h3>
          <p>Create your first static page by clicking the "Create New Page" button above.</p>
          <a href="/edit-page" className="btn-primary">
            <i className="fa-solid fa-plus"></i> Create First Page
          </a>
        </div>
      )}

      <div className="page-info-box">
        <h3>📄 Static Page Management</h3>
        <p>Use this section to manage your blog's static pages like About, Privacy Policy, Terms of Service, etc.</p>
        <ul>
          <li><strong>Active Pages</strong> - Visible to visitors and indexed by search engines</li>
          <li><strong>Inactive Pages</strong> - Hidden from visitors but preserved in database</li>
          <li><strong>Draft Pages</strong> - Work-in-progress pages not yet published</li>
          <li><strong>Menu Display</strong> - Control which pages appear in navigation menu</li>
          <li><strong>SEO Settings</strong> - Configure meta titles and descriptions for better search visibility</li>
        </ul>
        <p><em>Note: Changes to pages take effect immediately after saving.</em></p>
      </div>
    </div>
  );
}
