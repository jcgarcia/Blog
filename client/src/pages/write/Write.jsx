import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "../../contexts/UserContext";
import { useAdmin } from "../../contexts/AdminContext";
import { postsAPI, categoriesAPI, uploadAPI } from "../../services/postsAPI";
import RichTextEditor from "../../components/RichTextEditor/RichTextEditor";
import MediaSelector from "../../components/MediaSelector";
import "./write.css";
import PostImg from '../../media/NewPost.jpg';

// Helper function to convert S3 key to signed URL
const getSignedUrl = async (s3Key) => {
  if (!s3Key) return '';
  
  // If it's already a full URL (backward compatibility), return as-is
  if (s3Key.startsWith('http')) return s3Key;
  
  try {
    const response = await fetch(`https://bapi.ingasti.com/api/media/signed-url?key=${encodeURIComponent(s3Key)}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.signed_url;
    }
  } catch (error) {
    console.error('Error getting signed URL:', error);
  }
  
  return s3Key; // Fallback to original
};

// Convert S3 keys in content to signed URLs for display
const convertContentS3KeysToUrls = async (content) => {
  if (!content) return content;
  
  // Find all image references in the content (both img tags and markdown format)
  const imgRegex = /<img[^>]*src="([^"]*uploads\/[^"]*)"[^>]*>/g;
  const markdownImgRegex = /!\[[^\]]*\]\(([^)]*uploads\/[^)]*)\)/g;
  
  let updatedContent = content;
  let match;
  
  // Handle HTML img tags - preserve all attributes
  const imgMatches = [];
  while ((match = imgRegex.exec(content)) !== null) {
    imgMatches.push({ full: match[0], src: match[1] });
  }
  
  // Handle Markdown images
  const markdownMatches = [];
  while ((match = markdownImgRegex.exec(content)) !== null) {
    markdownMatches.push({ full: match[0], src: match[1] });
  }
  
  // Convert all found S3 keys to signed URLs
  for (const imgMatch of imgMatches) {
    if (imgMatch.src.startsWith('uploads/')) {
      try {
        const signedUrl = await getSignedUrl(imgMatch.src);
        // Replace only the src attribute value, preserving all other attributes
        const updatedImgTag = imgMatch.full.replace(imgMatch.src, signedUrl);
        updatedContent = updatedContent.replace(imgMatch.full, updatedImgTag);
      } catch (error) {
        console.error('Error generating signed URL:', error);
      }
    }
  }
  
  // Handle markdown images separately
  for (const markdownMatch of markdownMatches) {
    if (markdownMatch.src.startsWith('uploads/')) {
      try {
        const signedUrl = await getSignedUrl(markdownMatch.src);
        updatedContent = updatedContent.replace(markdownMatch.src, signedUrl);
      } catch (error) {
        console.error('Error converting S3 key to signed URL:', error);
      }
    }
  }
  
  return updatedContent;
};

export default function Write() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { adminUser, isAdmin } = useAdmin();
  
  // Define currentUser before using it in state initialization
  const currentUser = isAdmin && adminUser ? adminUser : user;
  const editPostId = searchParams.get('edit');
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: '',
    category: '',
    featuredImage: '',
    status: 'draft',
    authorId: currentUser?.id || '',
    published_at: ''
  });
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [postId, setPostId] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showMediaSelector, setShowMediaSelector] = useState(false);
  const [featuredImagePreviewUrl, setFeaturedImagePreviewUrl] = useState('');

  // Add auth check delay
  useEffect(() => {
    const timer = setTimeout(() => setAuthChecked(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (editPostId) {
      setIsEditing(true);
      setPostId(editPostId);
      loadPost(editPostId);
    }
    // Load categories and authors
    loadCategories();
    loadAuthors();
  }, [editPostId]);

  // Update featured image preview URL when featuredImage changes
  useEffect(() => {
    const updatePreviewUrl = async () => {
      if (formData.featuredImage) {
        const signedUrl = await getSignedUrl(formData.featuredImage);
        setFeaturedImagePreviewUrl(signedUrl);
      } else {
        setFeaturedImagePreviewUrl('');
      }
    };
    
    updatePreviewUrl();
  }, [formData.featuredImage]);

  // Load categories for dropdown (all active categories for post selection)
  const loadCategories = async () => {
    try {
      const response = await categoriesAPI.getCategories();
      if (response.success && response.data) {
        console.log('Categories loaded for post editor:', response.data);
        setCategories(response.data);
      } else {
        console.error('Failed to load categories:', response.error);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  // Load authors for dropdown (only for admins/editors)
  const loadAuthors = async () => {
    if (!canEditAuthor()) return;
    
    try {
      const response = await fetch('https://bapi.ingasti.com/api/users/authors', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken') || localStorage.getItem('userToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAuthors(data.users || []);
      }
    } catch (err) {
      console.error('Error loading authors:', err);
    }
  };

  // Check if user can edit author
  const canEditAuthor = () => {
    if (!currentUser) return false;
    const canEditRoles = ['admin', 'super_admin', 'editor'];
    return canEditRoles.includes(currentUser.role);
  };

  // Check if user can write posts
  const canWrite = () => {
    if (!currentUser) return false;
    const allowedRoles = ['admin', 'super_admin', 'editor', 'author', 'writer'];
    return allowedRoles.includes(currentUser.role);
  };

  // Load post for editing
  const loadPost = async (id) => {
    try {
      setLoading(true);
      const response = await postsAPI.getPostById(id);
      
      console.log('Load post response:', response); // Debug log
      
      if (response.success && response.data) {
        const post = response.data;
        console.log('Setting post data:', post); // Debug log
        
        // Convert S3 keys in content to signed URLs for display
        const contentWithSignedUrls = await convertContentS3KeysToUrls(post.content || '');
        
        // Handle featured image - convert S3 key to signed URL if needed
        let featuredImageUrl = post.featured_image || '';
        if (featuredImageUrl && featuredImageUrl.startsWith('uploads/')) {
          featuredImageUrl = await getSignedUrl(featuredImageUrl);
        }
        
        // Format published_at for datetime-local input if it exists
        let publishedAt = '';
        if (post.published_at) {
          const date = new Date(post.published_at);
          publishedAt = date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
        }
        
        setFormData({
          title: post.title || '',
          content: contentWithSignedUrls,
          excerpt: post.excerpt || '',
          category: post.category_id || '',
          featuredImage: featuredImageUrl,
          status: post.status || 'draft',
          authorId: post.author_id || currentUser?.id || '',
          published_at: publishedAt
        });
      } else {
        setError('Failed to load post for editing');
      }
    } catch (err) {
      console.error('Error loading post:', err);
      setError('Failed to load post for editing');
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload
  const handleImageUpload = async (file) => {
    try {
      setUploadingImage(true);
      const response = await uploadAPI.uploadFile(file);
      
      if (response.success) {
        // Media API returns a URL or key path
        const imagePath = response.data;
        setFormData(prev => ({
          ...prev,
          featuredImage: imagePath
        }));
        setSuccess('Image uploaded successfully!');
        setTimeout(() => setSuccess(''), 3000);
        return imagePath;
      } else {
        setError(response.error || 'Failed to upload image');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image');
      setTimeout(() => setError(''), 3000);
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle featured image file selection
  const handleFeaturedImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await handleImageUpload(file);
    }
  };

  // Handle media library selection
  const handleMediaSelect = (imageUrl) => {
    console.log('Write.jsx: Received imageUrl from MediaSelector:', imageUrl);
    setFormData(prev => ({
      ...prev,
      featuredImage: imageUrl
    }));
    setSuccess('Image selected from media library!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You must be logged in to write posts');
      return;
    }

    if (!canWrite()) {
      setError('You do not have permission to write posts');
      return;
    }

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    
    if (!formData.content || (typeof formData.content === 'string' && !formData.content.trim())) {
      setError('Content is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const postData = {
        title: formData.title,
        desc: formData.content, // API expects 'desc' field
        cat: formData.category,
        excerpt: formData.excerpt,
        status: formData.status
      };

      // Include author_id only if user can edit authors and author is selected
      if (canEditAuthor() && formData.authorId) {
        postData.author_id = formData.authorId;
      }
      
      // Include published_at if status is scheduled
      if (formData.status === 'scheduled' && formData.published_at) {
        postData.published_at = formData.published_at;
      }

      // Handle featured image - extract S3 key if it's a signed URL
      if (formData.featuredImage) {
        if (formData.featuredImage.includes('X-Amz-Algorithm')) {
          // Extract S3 key from signed URL to avoid database length issues
          try {
            const url = new URL(formData.featuredImage);
            const s3Key = url.pathname.substring(1); // Remove leading slash
            if (s3Key.startsWith('uploads/')) {
              postData.img = s3Key;
            } else {
              postData.img = formData.featuredImage;
            }
          } catch (error) {
            console.warn('Failed to extract S3 key, using original URL:', error);
            postData.img = formData.featuredImage;
          }
        } else {
          postData.img = formData.featuredImage;
        }
      }
      
      if (isEditing) {
        const response = await postsAPI.updatePost(postId, postData);
        if (response.success) {
          setSuccess('Post updated successfully!');
          setTimeout(() => {
            navigate(`/post/${postId}`);
          }, 1500);
        } else {
          // Check for specific authentication errors
          if (response.error && response.error.includes('expired')) {
            setError('Your session has expired. Please log in again to continue editing.');
            setTimeout(() => navigate('/userlogin'), 3000);
          } else if (response.error && response.error.includes('unauthorized')) {
            setError('Authentication failed. Please log in again to update this post.');
            setTimeout(() => navigate('/userlogin'), 3000);
          } else {
            setError(response.error || 'Failed to update post. Please try again.');
          }
        }
      } else {
        const response = await postsAPI.createPost(postData);
        if (response.success) {
          setSuccess('Post created successfully!');
          // Reset form if creating new post
          setFormData({
            title: '',
            content: '',
            excerpt: '',
            category: '',
            featuredImage: '',
            status: 'draft',
            authorId: currentUser?.id || '',
            published_at: ''
          });
        } else {
          // Check for specific authentication errors
          if (response.error && response.error.includes('expired')) {
            setError('Your session has expired. Please log in again to create posts.');
            setTimeout(() => navigate('/userlogin'), 3000);
          } else if (response.error && response.error.includes('unauthorized')) {
            setError('Authentication failed. Please log in again to create this post.');
            setTimeout(() => navigate('/userlogin'), 3000);
          } else {
            setError(response.error || 'Failed to create post. Please try again.');
          }
        }
      }
      
    } catch (err) {
      console.error('Error saving post:', err);
      
      // Handle specific error cases
      if (err.response?.status === 401) {
        setError('Your session has expired. Please log in again to continue.');
        setTimeout(() => navigate('/userlogin'), 3000);
      } else if (err.response?.status === 403) {
        setError('You do not have permission to perform this action.');
      } else if (err.response?.status === 500) {
        setError('Server error occurred. Please try again in a few moments.');
      } else if (err.message && err.message.includes('Network Error')) {
        setError('Network connection failed. Please check your internet connection.');
      } else {
        setError(err.response?.data?.message || 'Failed to save post. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Redirect if user can't write
  if (!authChecked) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!currentUser) {
    return (
      <div className="write">
        <div className="write-error">
          <h2>Access Denied</h2>
          <p>You must be logged in to write posts.</p>
          <button onClick={() => navigate('/userlogin')}>Login</button>
        </div>
      </div>
    );
  }

  if (!canWrite()) {
    return (
      <div className="write">
        <div className="write-error">
          <h2>Access Denied</h2>
          <p>You do not have permission to write posts.</p>
          <p>Current role: {currentUser.role}</p>
          <button onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="write">
      <img 
        className="writeImg" 
        src={PostImg}
        alt="Post writing" 
      />
      
      <div className="write-header">
        <h1>{isEditing ? 'Edit Post' : 'Write New Post'}</h1>
        <p>Welcome, {currentUser.firstName || currentUser.name || currentUser.username}!</p>
      </div>

      {error && <div className="write-error-message">{error}</div>}
      {success && <div className="write-success-message">{success}</div>}
      
      <form className="writeForm" onSubmit={handleSubmit}>
        <div className="writeFormGroup">
          <div className="featured-image-options">
            <label htmlFor="fileInput" className="file-upload-label">
              <i className="writeIcon fa-solid fa-file-arrow-up"></i> 
              {uploadingImage ? 'Uploading...' : 'Upload New Image'}
            </label>
            <input 
              type="file" 
              id="fileInput" 
              style={{display:"none"}} 
              accept="image/*"
              onChange={handleFeaturedImageChange}
              disabled={uploadingImage}
            />
            
            <button 
              type="button" 
              className="media-library-btn"
              onClick={() => setShowMediaSelector(true)}
            >
              <i className="writeIcon fa-solid fa-images"></i> 
              Choose from Library
            </button>
          </div>
          
          <input 
            type="text" 
            name="title"
            placeholder="Post Title" 
            className="writeInput" 
            value={formData.title}
            onChange={handleInputChange}
            autoFocus={true}
            required
          />
        </div>

        {formData.featuredImage && (
          <div className="writeFormGroup">
            <div className="featured-image-preview">
              <img src={featuredImagePreviewUrl || formData.featuredImage} alt="Featured" />
              <button 
                type="button" 
                className="remove-image-btn"
                onClick={() => setFormData(prev => ({ ...prev, featuredImage: '' }))}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
          </div>
        )}
        
        <div className="writeFormGroup">
          <input 
            type="text" 
            name="excerpt"
            placeholder="Brief excerpt or description" 
            className="writeInput" 
            value={formData.excerpt}
            onChange={handleInputChange}
          />
        </div>
        
        <div className="writeFormGroup">
          <select 
            name="category"
            className="writeInput writeSelect"
            value={formData.category}
            onChange={handleInputChange}
          >
            <option value="">Select Category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select 
            name="status"
            className="writeInput writeSelect"
            value={formData.status}
            onChange={handleInputChange}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
          </select>
          
          {formData.status === 'scheduled' && (
            <div className="writeFormGroup writeScheduleGroup">
              <label htmlFor="published_at" className="writeScheduleLabel">
                📅 Schedule Publication
              </label>
              <div className="writeScheduleInputs">
                <div className="writeScheduleField">
                  <label htmlFor="schedule_date" className="writeFieldLabel">Date</label>
                  <input
                    type="date"
                    id="schedule_date"
                    className="writeInput writeScheduleDate"
                    value={formData.published_at ? formData.published_at.slice(0, 10) : ''}
                    onChange={(e) => {
                      const date = e.target.value;
                      const time = formData.published_at ? formData.published_at.slice(11, 16) : '12:00';
                      setFormData({...formData, published_at: date ? `${date}T${time}` : ''});
                    }}
                    min={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </div>
                <div className="writeScheduleField">
                  <label htmlFor="schedule_time" className="writeFieldLabel">Time</label>
                  <input
                    type="time"
                    id="schedule_time"
                    className="writeInput writeScheduleTime"
                    value={formData.published_at ? formData.published_at.slice(11, 16) : '12:00'}
                    onChange={(e) => {
                      const time = e.target.value;
                      const date = formData.published_at ? formData.published_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
                      setFormData({...formData, published_at: `${date}T${time}`});
                    }}
                    required
                  />
                </div>
              </div>
              <small className="writeHelperText">
                ℹ️ Post will be saved as scheduled. You'll need to publish it manually at the scheduled time, or set up automated publishing.
              </small>
            </div>
          )}
        </div>

        {canEditAuthor() && (
          <div className="writeFormGroup">
            <select 
              name="authorId"
              className="writeInput writeSelect"
              value={formData.authorId}
              onChange={handleInputChange}
            >
              <option value="">Select Author</option>
              {authors.map(author => (
                <option key={author.id} value={author.id}>
                  {author.first_name && author.last_name 
                    ? `${author.first_name} ${author.last_name}` 
                    : author.username || `User ${author.id}`}
                </option>
              ))}
            </select>
            <small className="writeHelperText">
              Change the author of this post (Admin/Editor only)
            </small>
          </div>
        )}
        
        <div className="writeFormGroup writeFormGroupFull">
          <RichTextEditor
            value={formData.content}
            onChange={(content) => setFormData(prev => ({ ...prev, content }))}
            placeholder="Start writing your story..."
          />
        </div>
        
        <div className="writeFormActions">
          <button 
            type="button" 
            className="writeCancel"
            onClick={() => {
              // If editing, go back to ops content management, otherwise go to home
              if (isEditing) {
                navigate('/ops');
              } else {
                navigate('/');
              }
            }}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="writeSubmit"
            disabled={loading}
          >
            {loading ? 'Saving...' : (isEditing ? 'Update Post' : 'Publish Post')}
          </button>
        </div>
      </form>
      
      {showMediaSelector && (
        <MediaSelector
          onSelect={handleMediaSelect}
          selectedImage={formData.featuredImage}
          onClose={() => setShowMediaSelector(false)}
        />
      )}
    </div>
  );
}
