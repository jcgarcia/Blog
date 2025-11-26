import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '../../services/postsAPI';
import './DraftManagement.css';

export default function DraftManagement() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      const response = await postsAPI.getDrafts();
      setDrafts(response.data || []);
    } catch (error) {
      console.error('Error fetching drafts:', error);
      setError('Failed to fetch drafts');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (draftId) => {
    navigate(`/write?edit=${draftId}`);
  };

  const handleDelete = async (draft) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the draft "${draft.title}"? This action cannot be undone.`
    );
    
    if (confirmDelete) {
      try {
        const response = await postsAPI.deletePost(draft.id);
        if (response.status === 200 || response.data?.success) {
          alert('Draft deleted successfully!');
          // Refresh the list
          fetchDrafts();
        } else {
          alert('Failed to delete draft: ' + (response.data?.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error deleting draft:', error);
        alert('Failed to delete draft. Please try again.');
      }
    }
  };

  const handlePublish = async (draft) => {
    const confirmPublish = window.confirm(
      `Are you sure you want to publish "${draft.title}"?`
    );
    
    if (confirmPublish) {
      try {
        // Update post status to published
        const updateData = {
          title: draft.title,
          content: draft.content,
          status: 'published'
        };
        
        const response = await postsAPI.updatePost(draft.id, updateData);
        if (response.data?.success || response.status === 200) {
          alert('Draft published successfully!');
          // Refresh the list
          fetchDrafts();
        } else {
          alert('Failed to publish draft: ' + (response.data?.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error publishing draft:', error);
        alert('Failed to publish draft. Please try again.');
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

  if (loading) {
    return (
      <div className="draft-management">
        <div className="loading">Loading drafts...</div>
      </div>
    );
  }

  return (
    <div className="draft-management">
      <div className="header">
        <h1>Draft Management</h1>
        <button className="btn-secondary" onClick={() => navigate('/ops')}>
          ← Back to Content Management
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {drafts.length === 0 ? (
        <div className="empty-state">
          <h3>No Draft Posts Found</h3>
          <p>You don't have any draft posts at the moment.</p>
          <button className="btn-primary" onClick={() => navigate('/write')}>
            Create New Post
          </button>
        </div>
      ) : (
        <div className="drafts-table">
          <h2>Draft Posts ({drafts.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => (
                <tr key={draft.id}>
                  <td>
                    <div className="post-title">{draft.title}</div>
                    <div className="post-excerpt">
                      {draft.content ? draft.content.substring(0, 100) + '...' : 'No content'}
                    </div>
                  </td>
                  <td>{formatDate(draft.created_at)}</td>
                  <td>{formatDate(draft.updated_at || draft.created_at)}</td>
                  <td>
                    <div className="actions">
                      <button 
                        className="btn-edit"
                        onClick={() => handleEdit(draft.id)}
                        title="Edit draft"
                      >
                        Edit
                      </button>
                      <button 
                        className="btn-publish"
                        onClick={() => handlePublish(draft)}
                        title="Publish draft"
                      >
                        Publish
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDelete(draft)}
                        title="Delete draft"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
