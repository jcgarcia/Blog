import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAdmin } from '../../contexts/AdminContext';
import { staticPagesAPI } from '../../config/apiService';
import RichTextEditor from '../../components/RichTextEditor/RichTextEditor';
import './editPage.css';

export default function EditPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { adminUser, isAdmin } = useAdmin();
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    meta_title: '',
    meta_description: '',
    content: '',
    content_type: 'html',
    status: 'active',
    template: 'default',
    show_in_menu: false,
    menu_order: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [pageId, setPageId] = useState(null);

  const editPageId = searchParams.get('edit') || searchParams.get('id');
  const editPageSlug = searchParams.get('slug');

  useEffect(() => {
    if (!isAdmin) {
      navigate('/login');
      return;
    }

    if (editPageId) {
      setIsEditing(true);
      setPageId(editPageId);
      loadPageById(editPageId);
    } else if (editPageSlug) {
      setIsEditing(true);
      loadPageBySlug(editPageSlug);
    }
  }, [editPageId, editPageSlug, isAdmin, navigate]);

  // Load page for editing by ID
  const loadPageById = async (id) => {
    try {
      setLoading(true);
      const response = await staticPagesAPI.getPageById(id);
      
      console.log('Load page response:', response); // Debug log
      
      if (response.success && response.data) {
        const page = response.data;
        console.log('Setting page data:', page); // Debug log
        setFormData({
          slug: page.slug || '',
          title: page.title || '',
          meta_title: page.meta_title || '',
          meta_description: page.meta_description || '',
          content: page.content || '',
          content_type: page.content_type || 'html',
          status: page.status || 'active',
          template: page.template || 'default',
          show_in_menu: page.show_in_menu || false,
          menu_order: page.menu_order || 0
        });
      } else {
        setError('Failed to load page for editing');
      }
    } catch (err) {
      console.error('Error loading page:', err);
      setError('Failed to load page for editing');
    } finally {
      setLoading(false);
    }
  };

  // Load page for editing by slug
  const loadPageBySlug = async (slug) => {
    try {
      setLoading(true);
      const response = await staticPagesAPI.getPageBySlug(slug);
      
      console.log('Load page by slug response:', response); // Debug log
      
      if (response.success && response.data) {
        const page = response.data;
        console.log('Setting page data from slug:', page); // Debug log
        setPageId(page.id); // Set the page ID for updating
        setFormData({
          slug: page.slug || '',
          title: page.title || '',
          meta_title: page.meta_title || '',
          meta_description: page.meta_description || '',
          content: page.content || '',
          content_type: page.content_type || 'html',
          status: page.status || 'active',
          template: page.template || 'default',
          show_in_menu: page.show_in_menu || false,
          menu_order: page.menu_order || 0
        });
      } else {
        setError('Failed to load page for editing');
      }
    } catch (err) {
      console.error('Error loading page by slug:', err);
      setError('Failed to load page for editing');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.slug.trim() || !formData.content.trim()) {
      setError('Title, slug, and content are required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const pageData = {
        slug: formData.slug.trim(),
        title: formData.title.trim(),
        meta_title: formData.meta_title.trim() || null,
        meta_description: formData.meta_description.trim() || null,
        content: formData.content,
        content_type: formData.content_type,
        status: formData.status,
        template: formData.template,
        show_in_menu: formData.show_in_menu,
        menu_order: parseInt(formData.menu_order) || 0
      };

      if (isEditing) {
        const response = await staticPagesAPI.updatePage(pageId, pageData);
        if (response.success) {
          setSuccess('Page updated successfully!');
          setTimeout(() => {
            navigate(`/${formData.slug}`);
          }, 1500);
        } else {
          setError(response.error || 'Failed to update page');
        }
      } else {
        const response = await staticPagesAPI.createPage(pageData);
        if (response.success) {
          setSuccess('Page created successfully!');
          // Reset form if creating new page
          setFormData({
            slug: '',
            title: '',
            meta_title: '',
            meta_description: '',
            content: '',
            content_type: 'html',
            status: 'active',
            template: 'default',
            show_in_menu: false,
            menu_order: 0
          });
        } else {
          setError(response.error || 'Failed to create page');
        }
      }
    } catch (err) {
      console.error('Error saving page:', err);
      setError('Failed to save page. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate slug from title
  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  };

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title,
      // Auto-generate slug only if not editing or slug is empty
      slug: (!isEditing || !prev.slug) ? generateSlug(title) : prev.slug
    }));
  };

  if (loading && isEditing) {
    return (
      <div className="edit-page">
        <div className="loading">
          <p>Loading page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-page">
      <div className="edit-page-wrapper">
        <div className="edit-page-header">
          <h1>{isEditing ? 'Edit Page' : 'Create New Page'}</h1>
          <p>Welcome, {adminUser?.username}!</p>
        </div>

        <form onSubmit={handleSubmit} className="edit-page-form">
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="title">Page Title *</label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={handleTitleChange}
                placeholder="Enter page title"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="slug">URL Slug *</label>
              <input
                type="text"
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="page-url-slug"
                pattern="[a-z0-9-]+"
                title="Only lowercase letters, numbers, and hyphens allowed"
                required
              />
              <small>URL: /{formData.slug}</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="meta_title">SEO Title</label>
              <input
                type="text"
                id="meta_title"
                value={formData.meta_title}
                onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                placeholder="SEO meta title"
                maxLength="60"
              />
              <small>Recommended: 50-60 characters</small>
            </div>

            <div className="form-group">
              <label htmlFor="meta_description">SEO Description</label>
              <textarea
                id="meta_description"
                value={formData.meta_description}
                onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                placeholder="SEO meta description"
                rows="2"
                maxLength="160"
              />
              <small>Recommended: 150-160 characters</small>
            </div>
          </div>

          <div className="form-group form-group-full">
            <label htmlFor="content">Page Content *</label>
            <RichTextEditor
              value={formData.content}
              onChange={(content) => setFormData(prev => ({ ...prev, content }))}
              placeholder="Start writing your page content..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="template">Template</label>
              <select
                id="template"
                value={formData.template}
                onChange={(e) => setFormData(prev => ({ ...prev, template: e.target.value }))}
              >
                <option value="default">Default</option>
                <option value="full-width">Full Width</option>
                <option value="sidebar">With Sidebar</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.show_in_menu}
                  onChange={(e) => setFormData(prev => ({ ...prev, show_in_menu: e.target.checked }))}
                />
                Show in navigation menu
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="menu_order">Menu Order</label>
              <input
                type="number"
                id="menu_order"
                value={formData.menu_order}
                onChange={(e) => setFormData(prev => ({ ...prev, menu_order: e.target.value }))}
                min="0"
                step="1"
              />
              <small>Lower numbers appear first</small>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/ops')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Saving...' : (isEditing ? 'Update Page' : 'Create Page')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
