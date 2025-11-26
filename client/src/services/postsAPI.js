import axios from 'axios';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://bapi.ingasti.com/api' 
  : 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth tokens
api.interceptors.request.use(
  (config) => {
    // Add auth token if available (check both userToken and adminToken)
    const token = localStorage.getItem('userToken') || localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Clear auth tokens on unauthorized
      localStorage.removeItem('userToken');
      localStorage.removeItem('adminToken');
      
      // Show user-friendly message and redirect to login
      console.warn('Session expired. Please log in again.');
      
      // Only redirect if we're not already on the login page
      if (!window.location.pathname.includes('login')) {
        alert('Your session has expired. Please log in again.');
        window.location.href = '/userlogin';
      }
    }
    return Promise.reject(error);
  }
);

// Posts API
export const postsAPI = {
  // Get all posts or posts by category
  getPosts: (category = null) => {
    const url = category ? `/posts?cat=${category}` : '/posts';
    return api.get(url);
  },

  // Get draft posts
  getDrafts: (category = null) => {
    const url = category ? `/posts/drafts?cat=${category}` : '/posts/drafts';
    return api.get(url);
  },

  // Get single post by ID
  getPost: (id) => {
    return api.get(`/posts/${id}`);
  },

  // Search posts by query
  searchPosts: (query) => {
    return api.get(`/posts/search?query=${encodeURIComponent(query)}`);
  },

  // Get single post by ID (alias for consistency)
  getPostById: (id) => {
    return api.get(`/posts/${id}`).then(response => ({
      success: true,
      data: response.data
    })).catch(error => ({
      success: false,
      error: error.message
    }));
  },

  // Create new post using working publish endpoint
  createPost: async (postData) => {
    try {
      // First try the working publish/content endpoint (like CLI tool)
      const description = postData.desc || postData.excerpt || postData.content || postData.title || 'Blog post';
      const markdownContent = `---
title: ${postData.title}
description: ${description}
category: ${postData.cat || '1'}
excerpt: ${postData.excerpt || description}
status: ${postData.status || 'draft'}
---

${postData.content || postData.desc || description}`;

      // Get auth token
      const token = localStorage.getItem('userToken') || localStorage.getItem('adminToken');
      
      const response = await fetch(`${API_BASE_URL}/publish/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ markdownContent })
      });

      if (response.ok) {
        const result = await response.json();
        // Convert response to match expected format
        return {
          success: true,
          data: {
            id: result.postId,
            title: result.title,
            desc: result.description || result.excerpt,
            category: result.category,
            status: result.status || 'published',
            publishedAt: result.publishedAt,
            message: result.message
          }
        };
      } else {
        // If publish endpoint fails, get error details
        let errorMessage = 'Failed to create post';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // If we can't parse error JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        
        console.warn('Publish endpoint failed:', errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }
    } catch (error) {
      console.error('Publish endpoint error:', error.message);
      return {
        success: false,
        error: error.message || 'Network error occurred'
      };
    }
  },

  // Update existing post
  updatePost: async (id, postData) => {
    try {
      const response = await api.put(`/posts/${id}`, postData);
      return {
        success: true,
        data: response.data,
        message: response.data.message || 'Post updated successfully'
      };
    } catch (error) {
      console.error('Error updating post:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to update post'
      };
    }
  },

  // Delete post
  deletePost: (id) => {
    return api.delete(`/posts/${id}`);
  },
};

// Categories API
export const categoriesAPI = {
  // Get all categories
  getCategories: async (options = {}) => {
    try {
      let url = '/categories';
      const params = [];
      
      if (options.excludeJumble) {
        params.push('exclude_jumble=true');
      }
      
      if (options.sidebarOnly) {
        params.push('sidebar_only=true');
      }
      
      if (options.includeAll) {
        // For admin panel - don't apply any filters, get all categories
        // This overrides other filtering options
      } else {
        // Apply default filtering for public use
      }
      
      if (options.hierarchical) {
        params.push('hierarchical=true');
      }
      
      if (params.length > 0) {
        url += '?' + params.join('&');
      }
      
      const response = await api.get(url);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching categories:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch categories'
      };
    }
  },

  // Create a new category
  createCategory: async (categoryData) => {
    try {
      const response = await api.post('/categories', categoryData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error creating category:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data || 'Failed to create category'
      };
    }
  },

  // Update an existing category
  updateCategory: async (id, categoryData) => {
    try {
      const response = await api.put(`/categories/${id}`, categoryData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error updating category:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Failed to update category'
      };
    }
  },

  // Delete a category
  deleteCategory: async (id) => {
    try {
      const response = await api.delete(`/categories/${id}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error deleting category:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.response?.data?.message || 'Failed to delete category'
      };
    }
  },
};

// Upload API
export const uploadAPI = {
  // Upload file to media storage (S3/OCI)
  uploadFile: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Use the media upload endpoint that stores in S3/OCI
      const response = await api.post('/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // The media API returns a different structure: { success, message, media }
      if (response.data.success && response.data.media) {
        return {
          success: true,
          data: response.data.media.s3_key // Return S3 key for featuredImage string field
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Upload failed'
        };
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to upload file'
      };
    }
  },
};

export default api;
