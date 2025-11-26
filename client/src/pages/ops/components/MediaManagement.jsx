import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../../../config/api';
import './MediaManagement.css';

export default function MediaManagement() {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState('/');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(null); // Contains file object when moving
  const [newFolderName, setNewFolderName] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [activeSection, setActiveSection] = useState('library'); // 'library' or 'config'
  const [credentialStatus, setCredentialStatus] = useState(null);
  const [trashFiles, setTrashFiles] = useState([]);
  const [hasDeletedFiles, setHasDeletedFiles] = useState(false);
  // Media server configuration with OCI/AWS support
  const [mediaServerType, setMediaServerType] = useState('internal'); // 'internal', 'oci', 'aws'
  const [externalMediaServerUrl, setExternalMediaServerUrl] = useState('');
  const [cloudConfig, setCloudConfig] = useState({
    oci: {
      bucketName: '',
      namespace: '',
      region: 'us-ashburn-1',
      publicUrl: ''
    },
    aws: {
      bucketName: '',
      region: 'eu-west-2',
      roleArn: '',
      externalId: '',
      accessKey: '',
      secretKey: '',
      sessionToken: '',
      authMethod: 'identity-center', // 'identity-center', 'oidc'
      // OIDC Configuration
      accountId: '',
      oidcIssuerUrl: '',
      oidcAudience: 'sts.amazonaws.com',
      oidcSubject: ''
    }
  });

  // Helper function to check if AWS authentication is configured
  const isAwsAuthValid = () => {
    const hasBasicConfig = cloudConfig.aws.bucketName && cloudConfig.aws.region && cloudConfig.aws.roleArn;

    if (cloudConfig.aws.authMethod === 'oidc') {
      // For OIDC: need basic config, AWS account ID, OIDC issuer URL, and subject
      const hasOidcConfig = cloudConfig.aws.accountId && cloudConfig.aws.oidcIssuerUrl && cloudConfig.aws.oidcSubject;
      return hasBasicConfig && hasOidcConfig;
    } else {
      // For Identity Center: need basic config, external ID, and access keys
      const hasExternalId = cloudConfig.aws.externalId;
      const hasKeyAuth = cloudConfig.aws.accessKey && cloudConfig.aws.secretKey && cloudConfig.aws.sessionToken;
      return hasBasicConfig && hasExternalId && hasKeyAuth;
    }
  };

  useEffect(() => {
    // Load initial configuration
    loadMediaStorageConfig();
  }, []);

  useEffect(() => {
    if (mediaServerType === 'internal') {
      fetchMediaFiles();
      fetchFolders();
    } else if (mediaServerType === 'aws') {
      // Load existing AWS configuration including External ID
      loadAwsConfiguration();
      fetchMediaFiles(); // For AWS, we still load from database
      fetchFolders(); // AWS also uses folder structure
      fetchCredentialStatus(); // Check credential status
    } else {
      // TODO: Integrate with external media server API when available
      setMediaFiles([]);
      setFolders([]);
    }
  }, [currentFolder, pagination.page, filterType, searchTerm, mediaServerType]);

  // Additional useEffect to handle folder navigation state changes
  useEffect(() => {
    // Force component update when returning to root to ensure upload button visibility
    if (currentFolder === '/' && activeSection === 'library') {
      // Reset any stale state that might hide the upload button
      setLoading(false);
    }
  }, [currentFolder, activeSection]);

  // Load trash files to check if trash folder should be visible
  useEffect(() => {
    if (mediaServerType === 'internal' || mediaServerType === 'aws') {
      fetchTrashFiles();
    }
  }, [mediaServerType]);

  const loadMediaStorageConfig = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.SETTINGS.MEDIA_STORAGE, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          // Set the correct storage type from database
          console.log('Loading storage config:', data.config.storageType);
          setMediaServerType(data.config.storageType || 'internal');
          
          // Load cloud configurations if available
          if (data.config.awsConfig) {
            setCloudConfig(prev => ({
              ...prev,
              aws: {
                ...prev.aws,
                ...data.config.awsConfig
              }
            }));
          }
          
          if (data.config.ociConfig) {
            setCloudConfig(prev => ({
              ...prev,
              oci: {
                ...prev.oci,
                ...data.config.ociConfig
              }
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading media storage configuration:', error);
    }
  };

  const fetchMediaFiles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        folder: currentFolder,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filterType !== 'all' && { type: filterType }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`${API_ENDPOINTS.MEDIA.FILES}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Debug: Log PDF files to see thumbnail_url values
        const pdfFiles = (data.media || []).filter(file => file.mime_type === 'application/pdf');
        if (pdfFiles.length > 0) {
          console.log('🔍 PDF files received:', pdfFiles.map(file => ({
            name: file.original_name,
            thumbnail_url: file.thumbnail_url,
            thumbnail_path: file.thumbnail_path,
            hasThumbUrl: !!file.thumbnail_url
          })));
        }
        
        setMediaFiles(data.media || []);
        setPagination(data.pagination || pagination);
      }
    } catch (error) {
      console.error('Error fetching media files:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.MEDIA.FOLDERS, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  // Fetch trash files
  const fetchTrashFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.MEDIA.TRASH, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTrashFiles(data.files || []);
        setHasDeletedFiles((data.files || []).length > 0);
      }
    } catch (error) {
      console.error('Error fetching trash files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Restore file from trash
  const handleRestoreFile = async (fileId) => {
    if (!confirm('Are you sure you want to restore this file?')) return;

    try {
      const response = await fetch(API_ENDPOINTS.MEDIA.RESTORE(fileId), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🔄 Restore successful:', result);
        
        // Refresh trash files and regular media files
        await fetchTrashFiles();
        await fetchMediaFiles();
        
        alert('File restored successfully!');
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Restore failed:', response.status, errorData);
        alert(`Failed to restore file: ${errorData.message || `HTTP ${response.status}`}`);
      }
    } catch (error) {
      console.error('Error restoring file:', error);
      alert('Failed to restore file. Please try again.');
    }
  };

  // Empty trash (permanent delete all)
  const handleEmptyTrash = async () => {
    if (!confirm('⚠️ This will permanently delete ALL files in trash. This action CANNOT be undone. Are you sure?')) return;

    try {
      const response = await fetch(API_ENDPOINTS.MEDIA.EMPTY_TRASH, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🗑️ Empty trash successful:', result);
        
        // Refresh trash files
        await fetchTrashFiles();
        
        alert('Trash emptied successfully!');
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Empty trash failed:', response.status, errorData);
        alert(`Failed to empty trash: ${errorData.message || `HTTP ${response.status}`}`);
      }
    } catch (error) {
      console.error('Error emptying trash:', error);
      alert('Failed to empty trash. Please try again.');
    }
  };

  // Save AWS configuration to database
  const saveAwsConfiguration = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.SETTINGS.AWS_CONFIG, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({
          bucketName: cloudConfig.aws.bucketName,
          region: cloudConfig.aws.region,
          authMethod: cloudConfig.aws.authMethod,
          roleArn: cloudConfig.aws.roleArn,
          externalId: cloudConfig.aws.externalId,
          accessKey: cloudConfig.aws.accessKey,
          secretKey: cloudConfig.aws.secretKey,
          sessionToken: cloudConfig.aws.sessionToken,
          // Temporary Identity Center credentials
          tempAccessKey: cloudConfig.aws.tempAccessKey,
          tempSecretKey: cloudConfig.aws.tempSecretKey,
          tempSessionToken: cloudConfig.aws.tempSessionToken,
          // OIDC federation credentials
          accountId: cloudConfig.aws.accountId,
          oidcIssuerUrl: cloudConfig.aws.oidcIssuerUrl,
          oidcAudience: cloudConfig.aws.oidcAudience,
          oidcSubject: cloudConfig.aws.oidcSubject
        }),
      });

      if (response.ok) {
        const hasAccessKeys = cloudConfig.aws.accessKey && cloudConfig.aws.secretKey;
        const authMethod = cloudConfig.aws.authMethod === 'oidc' ? 'OIDC Web Identity' : hasAccessKeys ? 'Role-based + Access Keys (hybrid)' : 'Role-based (recommended)';
        
        const successMessage = cloudConfig.aws.authMethod === 'oidc' 
          ? `✅ AWS S3 Configuration Saved Successfully!\n\n🔐 Security Status:\n• Authentication: ${authMethod}\n• Bucket configured: ${cloudConfig.aws.bucketName}\n• Region: ${cloudConfig.aws.region}\n• Role ARN: ${cloudConfig.aws.roleArn}\n• OIDC Subject: ${cloudConfig.aws.oidcSubject}\n• Ready for secure S3 operations\n\n📋 Next Steps:\n• Verify AWS IAM role trust policy matches OIDC configuration\n• Test connection functionality`
          : `✅ AWS S3 Configuration Saved Successfully!\n\n🔐 Security Status:\n• Authentication: ${authMethod}\n• Bucket configured: ${cloudConfig.aws.bucketName}\n• Region: ${cloudConfig.aws.region}\n• Role ARN: ${cloudConfig.aws.roleArn}\n• External ID: Configured\n• Ready for secure S3 operations\n\n📋 Next Steps:\n• Verify AWS IAM role trust policy matches External ID\n• Test upload functionality`;
        
        alert(successMessage);
      } else {
        const error = await response.text();
        alert(`❌ Failed to save AWS configuration: ${error}`);
      }
    } catch (error) {
      console.error('Error saving AWS configuration:', error);
      alert('❌ Error saving AWS configuration. Please check your connection and try again.');
    }
  };

  // Test AWS connection
  const testAwsConnection = async () => {
    if (!isAwsAuthValid()) {
      alert('❌ Please configure all required AWS settings before testing connection.');
      return;
    }

    try {
      // Show loading state
      const testButton = document.querySelector('.btn-test-connection');
      const originalText = testButton.innerHTML;
      testButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';
      testButton.disabled = true;

      const response = await fetch(API_ENDPOINTS.MEDIA.TEST_AWS_CONNECTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        // No body needed - use stored configuration from credential manager
      });

      // Restore button state
      testButton.innerHTML = originalText;
      testButton.disabled = !isAwsAuthValid();

      if (response.ok) {
        const result = await response.json();
        alert(`✅ AWS S3 Connection Successful!\n\n🔐 Connection Details:\n• Bucket: ${cloudConfig.aws.bucketName}\n• Region: ${cloudConfig.aws.region}\n• Role: ${cloudConfig.aws.roleArn}\n• Status: ${result.status || 'Connected'}\n• Timestamp: ${new Date().toLocaleString()}\n\n✨ Ready to save configuration and start uploading media!`);
      } else {
        const errorData = await response.json();
        alert(`❌ AWS S3 Connection Failed\n\n🔍 Error Details:\n${errorData.error || 'Unknown error'}\n\n💡 Common Issues:\n• Check IAM role trust policy includes External ID\n• Verify credentials are not expired\n• Ensure bucket exists and is accessible\n• Confirm region matches bucket location`);
      }
    } catch (error) {
      console.error('Error testing AWS connection:', error);
      
      // Restore button state
      const testButton = document.querySelector('.btn-test-connection');
      if (testButton) {
        testButton.innerHTML = '<i class="fa-solid fa-plug"></i> Test Connection';
        testButton.disabled = !isAwsAuthValid();
      }
      
      alert(`❌ Connection Test Failed\n\n🔍 Error: ${error.message}\n\n💡 Please check:\n• Network connectivity\n• AWS credentials validity\n• Server configuration`);
    }
  };

  // Test OIDC connection
  const testOidcConnection = async () => {
    // Validate OIDC configuration
    if (!cloudConfig.aws.bucketName || !cloudConfig.aws.region || 
        !cloudConfig.aws.roleArn || !cloudConfig.aws.oidcIssuerUrl || 
        !cloudConfig.aws.accountId) {
      alert('❌ Please configure all required OIDC settings before testing connection.');
      return;
    }

    try {
      // Show loading state
      const testButton = document.querySelector('.btn-test-oidc-connection');
      const originalText = testButton.innerHTML;
      testButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing OIDC...';
      testButton.disabled = true;

      const response = await fetch(API_ENDPOINTS.MEDIA.TEST_OIDC_CONNECTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({
          oidcIssuerUrl: cloudConfig.aws.oidcIssuerUrl,
          oidcAudience: cloudConfig.aws.oidcAudience || 'sts.amazonaws.com',
          oidcSubject: cloudConfig.aws.oidcSubject,
          accountId: cloudConfig.aws.accountId,
          bucketName: cloudConfig.aws.bucketName,
          region: cloudConfig.aws.region,
          roleArn: cloudConfig.aws.roleArn
        }),
      });

      // Restore button state
      testButton.innerHTML = originalText;
      testButton.disabled = false;

      if (response.ok) {
        const result = await response.json();
        const config = result.configuration;
        const k8s = result.kubernetes;
        
        let alertMessage = `✅ OIDC Configuration Valid!\n\n🌐 Configuration Details:\n• OIDC Issuer: ${config.oidcIssuerUrl}\n• AWS Account: ${config.accountId}\n• AWS Role: ${config.roleArn}\n• S3 Bucket: ${config.bucketName}\n• Region: ${config.region}\n• Subject: ${config.oidcSubject}\n\n📋 Environment: ${k8s.environment}`;
        
        if (k8s.tokenAvailable) {
          alertMessage += `\n\n🔑 Kubernetes Token: ✅ Available`;
          if (k8s.tokenDetails) {
            alertMessage += `\n• Issuer: ${k8s.tokenDetails.issuer}\n• Subject: ${k8s.tokenDetails.subject}`;
            if (k8s.tokenDetails.expiresAt) {
              alertMessage += `\n• Expires: ${new Date(k8s.tokenDetails.expiresAt).toLocaleString()}`;
            }
          }
          alertMessage += `\n\n🚀 Status: ${result.nextSteps}`;
        } else {
          alertMessage += `\n\n⚠️  Kubernetes Token: Not available (running outside Kubernetes)\n\n🚀 Status: ${result.nextSteps}`;
        }
        
        alert(alertMessage);
      } else {
        const errorData = await response.json();
        alert(`❌ OIDC Configuration Invalid\n\n🔍 Error Details:\n${errorData.message}\n\n💡 Common Issues:\n• Check OIDC Issuer URL is accessible\n• Verify AWS Account ID is correct\n• Ensure IAM role ARN is correct\n• Confirm AWS OIDC Identity Provider is configured\n• Check role trust policy allows web identity`);
      }
    } catch (error) {
      console.error('Error testing OIDC connection:', error);
      
      // Restore button state
      const testButton = document.querySelector('.btn-test-oidc-connection');
      if (testButton) {
        testButton.innerHTML = '<i class="fa-solid fa-globe"></i> Test OIDC Configuration';
        testButton.disabled = false;
      }
      
      alert(`❌ OIDC Test Failed\n\n🔍 Error: ${error.message}\n\n💡 Please check:\n• Network connectivity\n• OIDC configuration\n• Server configuration`);
    }
  };

  // Load existing AWS configuration from database
  const loadAwsConfiguration = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.SETTINGS.GET_ADMIN, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.awsConfig) {
          setCloudConfig(prev => ({
            ...prev,
            aws: {
              ...prev.aws,
              ...data.awsConfig
            }
          }));
        }
      }
    } catch (error) {
      console.error('Error loading AWS configuration:', error);
    }
  };

  // Sync S3 bucket with database
  const syncS3WithDatabase = async () => {
    if (mediaServerType !== 'aws') {
      alert('S3 sync is only available for AWS storage');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.MEDIA.SYNC_S3, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Sync completed! ${result.synced} files added to database.`);
        // Refresh media files after sync
        fetchMediaFiles();
      } else {
        const error = await response.json();
        alert(`Sync failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Error syncing S3:', error);
      alert('Error syncing S3 bucket with database');
    } finally {
      setLoading(false);
    }
  };

  // Sync S3 bucket with database using OIDC authentication
  const syncS3WithOIDC = async () => {
    if (mediaServerType !== 'aws') {
      alert('S3 sync is only available for AWS storage');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.MEDIA.SYNC_S3_OIDC, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        alert(`OIDC Sync completed! ${result.synced} files added to database.`);
        // Refresh media files after sync
        fetchMediaFiles();
      } else {
        const error = await response.json();
        alert(`OIDC Sync failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Error syncing S3 with OIDC:', error);
      alert('Error syncing S3 bucket with database using OIDC');
    } finally {
      setLoading(false);
    }
  };

  // Refresh AWS credentials manually
  const refreshAwsCredentials = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.MEDIA.REFRESH_CREDENTIALS, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert('✅ AWS credentials refreshed successfully! You can now test the connection.');
        // Update credential status after refresh
        await fetchCredentialStatus();
      } else if (result.requiresNewCredentials) {
        // Show detailed instructions for getting fresh credentials
        const instructions = result.instructions.join('\n');
        alert(`🔄 ${result.message}\n\nRequired Actions:\n${instructions}\n\nAfter obtaining fresh credentials, paste them into the form above and click "Save Configuration".`);
      } else {
        alert(`❌ Failed to refresh credentials: ${result.message}`);
      }
    } catch (error) {
      console.error('Error refreshing credentials:', error);
      alert('❌ Error refreshing AWS credentials');
    } finally {
      setLoading(false);
    }
  };

  // Fetch credential status
  const fetchCredentialStatus = async () => {
    if (mediaServerType !== 'aws') return;
    
    try {
      const response = await fetch(API_ENDPOINTS.MEDIA.CREDENTIAL_STATUS, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCredentialStatus(data.status);
      }
    } catch (error) {
      console.error('Error fetching credential status:', error);
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) {
      console.log('No files selected');
      return;
    }

    console.log('Starting upload for', files.length, 'files to storage type:', mediaServerType);
    setUploading(true);
    
    const uploadPromises = Array.from(files).map(async (file) => {
      console.log('Uploading file:', file.name, 'size:', file.size, 'type:', file.type);
      const formData = new FormData();
      formData.append('file', file);
      
      // Add current folder information
      if (currentFolder && currentFolder !== '/') {
        formData.append('folder', currentFolder);
      }
      
      // Add storage type info for backend
      formData.append('storageType', mediaServerType);

      try {
        console.log('Sending request to:', API_ENDPOINTS.MEDIA.UPLOAD);
        const response = await fetch(API_ENDPOINTS.MEDIA.UPLOAD, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          },
          body: formData,
        });

        console.log('Upload response status:', response.status);
        
        if (!response.ok) {
          let errorMessage;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
          } catch {
            errorMessage = await response.text() || `HTTP ${response.status} ${response.statusText}`;
          }
          console.error('Upload failed:', errorMessage);
          throw new Error(`Upload failed for ${file.name}: ${errorMessage}`);
        }

        const result = await response.json();
        console.log('Upload successful:', result);
        
        if (!result.success) {
          throw new Error(result.message || 'Upload failed');
        }
        
        return result;
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        const errorMsg = error.message || 'Unknown error';
        alert(`❌ Failed to upload ${file.name}:\n${errorMsg}\n\nPlease check:\n• File size and format\n• Network connection\n• AWS S3 configuration`);
        return null;
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const successful = results.filter(r => r !== null);
      console.log(`Upload complete: ${successful.length}/${files.length} files uploaded`);
      
      if (successful.length > 0) {
        await fetchMediaFiles();
        alert(`Successfully uploaded ${successful.length} file(s)`);
      }
      setShowUploadModal(false);
    } catch (error) {
      console.error('Error during upload:', error);
      alert('Upload process failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch(API_ENDPOINTS.MEDIA.FOLDERS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({
          name: newFolderName,
          parentPath: currentFolder
        }),
      });

      if (response.ok) {
        await fetchFolders();
        setNewFolderName('');
        setShowCreateFolder(false);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      console.log(`🗑️ Attempting to delete file with ID: ${fileId}`);
      
      const response = await fetch(API_ENDPOINTS.MEDIA.DELETE(fileId), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      console.log(`🗑️ Delete response status: ${response.status}`);

      if (response.ok) {
        const result = await response.json();
        console.log('🗑️ Delete successful:', result);
        
        // Refresh appropriate file lists based on current folder
        if (currentFolder === '/trash') {
          // In trash folder: refresh trash files (permanent delete)
          await fetchTrashFiles();
        } else {
          // In regular folder: refresh media files and trash count (soft delete to trash)
          setMediaFiles([]);
          await fetchMediaFiles();
          await fetchTrashFiles(); // Update trash count
        }
        
        // Show success message
        alert(currentFolder === '/trash' ? 'File permanently deleted!' : 'File moved to trash!');
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Delete failed:', response.status, errorData);
        alert(`Failed to delete file: ${errorData.message || `HTTP ${response.status}`}`);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert(`Error deleting file: ${error.message}`);
    }
  };

  const handleMoveFile = async (fileId, targetFolder) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.MEDIA.FILES}/${fileId}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
        body: JSON.stringify({ targetFolder }),
      });

      if (response.ok) {
        setShowMoveModal(null);
        await fetchMediaFiles();
        await fetchFolders(); // Refresh folder counts
        alert('File moved successfully!');
      } else {
        const error = await response.text();
        alert(`Error moving file: ${error}`);
      }
    } catch (error) {
      console.error('Error moving file:', error);
      alert('Error moving file. Please try again.');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType, mimeType) => {
    if (mimeType && mimeType.startsWith('image/')) {
      return 'fa-image';
    } else if (mimeType && mimeType.startsWith('video/')) {
      return 'fa-video';
    } else if (fileType === 'pdf') {
      return 'fa-file-pdf';
    }
    return 'fa-file';
  };

  const isImage = (mimeType) => mimeType && mimeType.startsWith('image/');

  // Generate secure External ID for AWS S3 integration
  const generateExternalId = async () => {
    // Generate cryptographically secure External ID
    // Format: alphanumeric + allowed special chars (+-=,.@:/-)
    // Length: 32 characters for high entropy
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-=,.@:/-';
    const length = 32;
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    const externalId = Array.from(array, byte => chars[byte % chars.length]).join('');
    
    try {
      // Save External ID to database via settings API
      const response = await fetch(API_ENDPOINTS.SETTINGS.AWS_EXTERNAL_ID, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          externalId: externalId,
          generatedAt: new Date().toISOString(),
          generatedBy: 'admin'
        })
      });

      if (response.ok) {
        // Update the configuration
        setCloudConfig(prev => ({
          ...prev,
          aws: { 
            ...prev.aws, 
            externalId: externalId 
          }
        }));

        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(externalId);
          alert(`✅ Secure External ID generated and copied to clipboard!\n\n🔐 External ID: ${externalId}\n\n⚠️ IMPORTANT SECURITY NOTES:\n• External ID has been saved securely in the database\n• Value copied to clipboard for easy AWS configuration\n• Keep this External ID secret and secure\n• Use this value in your AWS IAM role trust policy\n• Never share in public repositories or documentation\n• Rotate this ID quarterly for best security`);
        } catch (clipboardError) {
          alert(`✅ Secure External ID generated and saved!\n\n🔐 External ID: ${externalId}\n\n📋 Please manually copy this value (clipboard access not available)\n\n⚠️ IMPORTANT SECURITY NOTES:\n• External ID has been saved securely in the database\n• Keep this External ID secret and secure\n• Use this value in your AWS IAM role trust policy\n• Never share in public repositories or documentation\n• Rotate this ID quarterly for best security`);
        }
        
        console.log('Generated and saved External ID for AWS S3 integration:', externalId);
      } else {
        throw new Error('Failed to save External ID to database');
      }
    } catch (error) {
      console.error('Error saving External ID:', error);
      alert(`❌ Error saving External ID to database.\n\nGenerated ID: ${externalId}\n\nPlease contact your system administrator.`);
    }
  };

  // Copy External ID to clipboard
  const copyExternalId = async () => {
    const externalId = cloudConfig.aws.externalId;
    if (!externalId) {
      alert('No External ID available. Please generate one first.');
      return;
    }

    try {
      await navigator.clipboard.writeText(externalId);
      alert(`📋 External ID copied to clipboard!\n\n🔐 External ID: ${externalId}\n\n⚠️ Remember: Use this value in your AWS IAM role trust policy`);
    } catch (error) {
      alert(`Manual copy required:\n\n🔐 External ID: ${externalId}\n\nPlease manually copy this value (clipboard access not available)`);
    }
  };

  return (
    <div className="media-management">
      {/* Section Navigation */}
      <div className="section-navigation">
        <button 
          className={`section-tab ${activeSection === 'library' ? 'active' : ''}`}
          onClick={() => setActiveSection('library')}
        >
          <i className="fa-solid fa-images"></i>
          Media Library
        </button>
        <button 
          className={`section-tab ${activeSection === 'config' ? 'active' : ''}`}
          onClick={() => setActiveSection('config')}
        >
          <i className="fa-solid fa-gear"></i>
          Storage Configuration
        </button>
      </div>

      {/* Media Library Section */}
      {activeSection === 'library' && (
        <div className="library-section" key={`library-${currentFolder}-${mediaFiles.length}`}>
          <div className="section-header">
            <h2>Media Library</h2>
            <div className="media-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowCreateFolder(true)}
                disabled={mediaServerType === 'external'}
                title={mediaServerType === 'external' ? 'Folder creation disabled for external storage' : 'Create a new folder'}
              >
                <i className="fa-solid fa-folder-plus"></i> New Folder
              </button>
              <button 
                className="btn-primary"
                onClick={() => setShowUploadModal(true)}
                disabled={mediaServerType === 'external' || uploading}
                title={mediaServerType === 'external' ? 'Upload disabled for external storage' : uploading ? 'Upload in progress...' : 'Upload media files'}
              >
                <i className="fa-solid fa-upload"></i> 
                {uploading ? 'Uploading...' : 'Upload Media'}
              </button>
              {(mediaServerType === 'oci' || mediaServerType === 'aws') && (
                <button 
                  className="btn-warning"
                  onClick={mediaServerType === 'aws' ? saveAwsConfiguration : () => alert('OCI configuration will be implemented in future version.')}
                  disabled={mediaServerType === 'aws' && !isAwsAuthValid()}
                  title={
                    mediaServerType === 'aws' 
                      ? `Save AWS S3 configuration to database. Auth: ${cloudConfig.aws.roleArn ? 'Role' : cloudConfig.aws.accessKey ? 'Keys' : 'None'}` 
                      : 'Configure OCI Object Storage'
                  }
                  style={{
                    opacity: mediaServerType === 'aws' && !isAwsAuthValid() ? 0.5 : 1
                  }}
                >
                  <i className="fa-solid fa-cloud"></i> {mediaServerType === 'aws' ? 'Save AWS Config' : 'Configure Cloud'}
                </button>
              )}
            </div>
          </div>

          {/* Current Storage Info */}
          <div className="current-storage-info">
            <span>Current Storage: <strong>{mediaServerType === 'aws' ? 'AWS S3' : mediaServerType === 'oci' ? 'Oracle Cloud' : mediaServerType === 'internal' ? 'Internal Server' : 'External Server'}</strong></span>
            <button 
              className="btn-link"
              onClick={() => setActiveSection('config')}
            >
              <i className="fa-solid fa-gear"></i> Change Storage
            </button>
          </div>

          {/* Media Controls */}
          <div className="media-controls">
            <div className="media-search">
              <input
                type="text"
                placeholder="Search media files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            <div className="media-filters">
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Files</option>
                <option value="jpg">Images (JPG)</option>
                <option value="png">Images (PNG)</option>
                <option value="gif">Images (GIF)</option>
                <option value="pdf">Documents (PDF)</option>
                <option value="mp4">Videos (MP4)</option>
              </select>
            </div>

            <div className="folder-breadcrumb">
              <span>Location: {currentFolder}</span>
            </div>
          </div>

          {/* Folder Navigation */}
          {(folders.length > 0 || currentFolder !== '/') && (
            <div className="folder-navigation">
              <h3>Folders</h3>
              <div className="folders-grid">
                {currentFolder !== '/' && (
                  <div 
                    className="folder-item back-button"
                    onClick={async () => {
                      setCurrentFolder('/');
                      // Reset pagination to page 1 when going back to root
                      setPagination(prev => ({ ...prev, page: 1 }));
                      // Clear any search/filter state that might interfere
                      setSearchTerm('');
                      setFilterType('all');
                      // Force immediate re-render by updating loading state
                      setLoading(true);
                      // Fetch data immediately - no timeout needed
                      try {
                        await Promise.all([
                          fetchFolders(),
                          fetchMediaFiles()
                        ]);
                      } catch (error) {
                        console.error('Error refreshing media library:', error);
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <i className="fa-solid fa-arrow-up"></i>
                    <span>.. (Back to root)</span>
                  </div>
                )}
                {folders.length > 0 && folders
                  .filter(folder => {
                    // Hide Root folder - it's the default view, users don't need to click on it
                    if (folder.path === '/' || folder.name === 'Root') {
                      return false;
                    }
                    
                    // Hide Trash folder - access via trash button instead
                    if (folder.path === '/trash' || folder.name === 'Trash') {
                      return false;
                    }
                    
                    // Show folders that are direct children of current folder
                    if (currentFolder === '/') {
                      return !folder.path.includes('/', 1); // Root level folders
                    }
                    return folder.path.startsWith(currentFolder) && 
                           folder.path !== currentFolder &&
                           folder.path.split('/').length === currentFolder.split('/').length + 1;
                  })
                  .map(folder => (
                    <div 
                      key={folder.id}
                      className="folder-item"
                      onClick={() => setCurrentFolder(folder.path)}
                    >
                      <i className="fa-solid fa-folder"></i>
                      <span>{folder.name}</span>
                      <small>({folder.file_count} files)</small>
                    </div>
                  ))}

                {/* Trash Button - show when in root and has deleted files */}
                {currentFolder === '/' && hasDeletedFiles && (
                  <div 
                    className="folder-item trash-folder"
                    onClick={() => {
                      setCurrentFolder('/trash');
                      fetchTrashFiles();
                    }}
                  >
                    <i className="fa-solid fa-trash"></i>
                    <span>Trash</span>
                    <small>({trashFiles.length} deleted files)</small>
                  </div>
                )}
                
                {currentFolder !== '/' && (
                  <div className="folder-current-info">
                    <i className="fa-solid fa-info-circle"></i>
                    <small>Currently viewing: {currentFolder}</small>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Media Grid */}
          {loading ? (
            <div className="loading">Loading media files...</div>
          ) : (
            <div className="media-grid">
              {/* Show trash controls when in trash folder */}
              {currentFolder === '/trash' && (
                <div className="trash-controls">
                  <div className="trash-header">
                    <h3><i className="fa-solid fa-trash"></i> Trash ({trashFiles.length} files)</h3>
                    {trashFiles.length > 0 && (
                      <button 
                        className="btn-danger"
                        onClick={handleEmptyTrash}
                        title="Permanently delete all files in trash"
                      >
                        <i className="fa-solid fa-trash-can"></i> Empty Trash
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Show appropriate file list based on current folder */}
              {(currentFolder === '/trash' ? trashFiles : mediaFiles).length === 0 ? (
                <div className="media-empty">
                  <i className={currentFolder === '/trash' ? "fa-solid fa-trash" : "fa-solid fa-image"}></i>
                  <p>{currentFolder === '/trash' ? 'No files in trash' : 'No media files found'}</p>
                  {currentFolder !== '/trash' && (
                    <button 
                      className="btn-primary"
                      onClick={() => setShowUploadModal(true)}
                    >
                      Upload your first file
                    </button>
                  )}
                </div>
              ) : (
                (currentFolder === '/trash' ? trashFiles : mediaFiles).map(file => {
                  // Debug PDF thumbnail condition
                  if (file.mime_type === 'application/pdf') {
                    console.log(`🖼️ PDF ${file.original_name}:`, {
                      hasThumbnailUrl: !!file.thumbnail_url,
                      thumbnailUrl: file.thumbnail_url,
                      willShowImage: !!(file.mime_type === 'application/pdf' && file.thumbnail_url)
                    });
                  }
                  
                  return (
                    <div key={file.id} className="media-item">
                      <div className="media-thumbnail">
                        {(isImage(file.mime_type) || (file.mime_type === 'application/pdf' && file.thumbnail_url)) ? (
                        <img 
                          src={file.thumbnail_url || file.public_url || file.signed_url} 
                          alt={file.alt_text || file.original_name}
                          className={file.mime_type === 'application/pdf' ? 'pdf-thumbnail' : ''}
                          onError={(e) => {
                            // If thumbnail fails, try the original image (for images) or show file icon
                            if (file.thumbnail_url && e.target.src === file.thumbnail_url) {
                              if (isImage(file.mime_type)) {
                                e.target.src = file.public_url || file.signed_url;
                              } else {
                                // For PDFs, just show the file icon if thumbnail fails
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }
                            } else {
                              // If all fails, show file icon
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }
                          }}
                          loading="lazy"
                        />
                      ) : null}
                      <div 
                        className="file-icon" 
                        style={{ display: (isImage(file.mime_type) || (file.mime_type === 'application/pdf' && file.thumbnail_url)) ? 'none' : 'flex' }}
                      >
                        <i className={`fa-solid ${getFileIcon(file.file_type, file.mime_type)}`}></i>
                      </div>
                    </div>
                    
                    <div className="media-info">
                      <h4 title={file.original_name}>{file.original_name}</h4>
                      <p className="file-size">{formatFileSize(file.file_size)}</p>
                      <p className="file-type">{(file.file_type || 'file').toUpperCase()}</p>
                      <p className="upload-date">
                        {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="media-item-actions">
                      {currentFolder === '/trash' ? (
                        // Trash file actions: restore or permanently delete
                        <>
                          <button 
                            className="btn-icon restore"
                            onClick={() => handleRestoreFile(file.id)}
                            title="Restore file from trash"
                          >
                            <i className="fa-solid fa-arrow-rotate-left"></i>
                          </button>
                          <button 
                            className="btn-icon delete permanent"
                            onClick={() => handleDeleteFile(file.id)}
                            title="Permanently delete file"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </>
                      ) : (
                        // Regular file actions
                        <>
                          <button 
                            className="btn-icon"
                            onClick={() => window.open(file.public_url || file.signed_url, '_blank')}
                            title="View file"
                          >
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          <button 
                            className="btn-icon"
                            onClick={() => navigator.clipboard.writeText(file.public_url || file.signed_url)}
                            title="Copy URL"
                          >
                            <i className="fa-solid fa-copy"></i>
                          </button>
                          <button 
                            className="btn-icon"
                            onClick={() => setShowMoveModal(file)}
                            title="Move to different folder"
                          >
                            <i className="fa-solid fa-arrows-turn-right"></i>
                          </button>
                          <button 
                            className="btn-icon delete"
                            onClick={() => handleDeleteFile(file.id)}
                            title="Delete file"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </>
                      )}
                    </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button 
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <button 
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Configuration Section */}
      {activeSection === 'config' && (
        <div className="config-section">
          <div className="section-header">
            <h2>Storage Configuration</h2>
            <p className="section-description">Configure where your media files are stored and managed.</p>
          </div>
          
          <div className="media-server-config">
          <label>Media Server:</label>
          <select value={mediaServerType} onChange={e => {
            setMediaServerType(e.target.value);
            // Clear existing credential status when changing server type
            setCredentialStatus(null);
          }}>
            <option value="internal">Internal (Blog Server)</option>
            <option value="oci">Oracle Cloud Infrastructure (OCI)</option>
            <option value="aws">
              {cloudConfig.aws?.authMethod === 'oidc' 
                ? 'Amazon Web Services (AWS) - OIDC Federation'
                : 'Amazon Web Services (AWS) - Identity Center'
              }
            </option>
            <option value="external">External Media Server</option>
          </select>
          
          {mediaServerType === 'oci' && (
            <div className="cloud-media-config">
              <h4>OCI Object Storage Configuration</h4>
              <div className="config-grid">
                <div className="config-field">
                  <label>Bucket Name:</label>
                  <input
                    type="text"
                    value={cloudConfig.oci.bucketName}
                    onChange={e => setCloudConfig(prev => ({
                      ...prev,
                      oci: { ...prev.oci, bucketName: e.target.value }
                    }))}
                    placeholder="my-media-bucket"
                  />
                </div>
                <div className="config-field">
                  <label>Namespace:</label>
                  <input
                    type="text"
                    value={cloudConfig.oci.namespace}
                    onChange={e => setCloudConfig(prev => ({
                      ...prev,
                      oci: { ...prev.oci, namespace: e.target.value }
                    }))}
                    placeholder="your-tenancy-namespace"
                  />
                </div>
                <div className="config-field">
                  <label>Region:</label>
                  <select
                    value={cloudConfig.oci.region}
                    onChange={e => setCloudConfig(prev => ({
                      ...prev,
                      oci: { ...prev.oci, region: e.target.value }
                    }))}
                  >
                    <option value="us-ashburn-1">US East (Ashburn)</option>
                    <option value="us-phoenix-1">US West (Phoenix)</option>
                    <option value="eu-frankfurt-1">EU (Frankfurt)</option>
                    <option value="ap-mumbai-1">Asia Pacific (Mumbai)</option>
                  </select>
                </div>
                <div className="config-field">
                  <label>Public URL Base:</label>
                  <input
                    type="url"
                    value={cloudConfig.oci.publicUrl}
                    onChange={e => setCloudConfig(prev => ({
                      ...prev,
                      oci: { ...prev.oci, publicUrl: e.target.value }
                    }))}
                    placeholder="https://objectstorage.us-ashburn-1.oraclecloud.com/n/namespace/b/bucket/o/"
                  />
                </div>
              </div>
              <div className="media-server-status">
                <small style={{ color: 'orange' }}>
                  ⚠️ OCI integration requires proper API credentials configured on the server.
                </small>
              </div>
            </div>
          )}
          
          {mediaServerType === 'aws' && (
            <div className="cloud-media-config">
              <h4>AWS S3 Configuration</h4>
              <div className="config-info">
                <div className="security-notice">
                  <i className="fa-solid fa-shield-halved"></i>
                  <strong>Enterprise Security Configuration</strong>
                  <p>This integration uses IAM roles and AWS Organizations with Identity Center for secure, credential-free access. No IAM users or access keys are required.</p>
                </div>
              </div>
              
              <div className="aws-config-main">
                <div className="aws-config-fields">
                  <div className="config-grid">
                    <div className="config-field">
                      <label>Bucket Name:</label>
                      <input
                        type="text"
                        value={cloudConfig.aws.bucketName}
                        onChange={e => setCloudConfig(prev => ({
                          ...prev,
                          aws: { ...prev.aws, bucketName: e.target.value.trim() }
                        }))}
                        placeholder="my-media-bucket"
                      />
                    </div>
                    <div className="config-field">
                      <label>Region:</label>
                      <select
                        value={cloudConfig.aws.region}
                        onChange={e => setCloudConfig(prev => ({
                          ...prev,
                          aws: { ...prev.aws, region: e.target.value }
                        }))}
                      >
                        <option value="us-east-1">US East (N. Virginia)</option>
                        <option value="us-west-2">US West (Oregon)</option>
                        <option value="eu-west-1">Europe (Ireland)</option>
                        <option value="eu-west-2">Europe (London)</option>
                        <option value="eu-central-1">Europe (Frankfurt)</option>
                        <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                        <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                      </select>
                    </div>
                    <div className="config-field">
                      <label>IAM Role ARN:</label>
                      <input
                        type="text"
                        value={cloudConfig.aws.roleArn || ''}
                        onChange={e => setCloudConfig(prev => ({
                          ...prev,
                          aws: { ...prev.aws, roleArn: e.target.value.trim() }
                        }))}
                        placeholder="arn:aws:iam::ACCOUNT:role/MediaUploadRole"
                      />
                      <small>Cross-account IAM role for secure access</small>
                    </div>
                {/* External ID - Only show for Identity Center authentication */}
                {cloudConfig.aws?.authMethod !== 'oidc' && (
                <div className="config-field">
                  <label>External ID (Required):</label>
                  <div className="external-id-input-group">
                    <input
                      type="text"
                      value={cloudConfig.aws.externalId || ''}
                      onChange={e => setCloudConfig(prev => ({
                        ...prev,
                        aws: { ...prev.aws, externalId: e.target.value.trim() }
                      }))}
                      placeholder="Click Generate to create secure External ID"
                      className="external-id-input"
                      readOnly={!!cloudConfig.aws.externalId}
                    />
                    <div className="external-id-buttons">
                      <button
                        type="button"
                        className="btn-generate-external-id"
                        onClick={generateExternalId}
                        title="Generate secure External ID"
                        disabled={!!cloudConfig.aws.externalId}
                      >
                        <i className="fa-solid fa-refresh"></i> Generate
                      </button>
                      {cloudConfig.aws.externalId && (
                        <button
                          type="button"
                          className="btn-copy-external-id"
                          onClick={copyExternalId}
                          title="Copy External ID to clipboard"
                        >
                          <i className="fa-solid fa-copy"></i> Copy
                        </button>
                      )}
                      {cloudConfig.aws.externalId && (
                        <button
                          type="button"
                          className="btn-regenerate-external-id"
                          onClick={() => {
                            if (confirm('⚠️ WARNING: Regenerating the External ID will invalidate the current AWS IAM role configuration.\n\nYou will need to update your AWS IAM role trust policy with the new External ID.\n\nAre you sure you want to continue?')) {
                              setCloudConfig(prev => ({
                                ...prev,
                                aws: { ...prev.aws, externalId: '' }
                              }));
                            }
                          }}
                          title="Regenerate External ID (requires AWS configuration update)"
                        >
                          <i className="fa-solid fa-rotate"></i> Regenerate
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="external-id-info">
                    <small><strong>Critical Security:</strong> External ID prevents confused deputy attacks</small>
                    <small><strong>Requirements:</strong> 2-1,224 characters, alphanumeric + special chars (+-=,.@:/-)</small>
                    <small><strong>Best Practice:</strong> Generate unique ID per AWS account, rotate quarterly</small>
                    {cloudConfig.aws.externalId && (
                      <small><strong>Status:</strong> ✅ External ID configured and saved securely in database</small>
                    )}
                  </div>
                </div>
                )}

                  </div>
                </div>
                
                {/* Authentication Method Selection */}
                <div className="auth-method-selection">
                  <div className="auth-section-header">
                    <h5><i className="fa-solid fa-shield-alt"></i> Authentication Method</h5>
                  </div>
                  <div className="config-field">
                    <label>Select Authentication Method:</label>
                    <select 
                      value={cloudConfig.aws?.authMethod || 'identity-center'} 
                      onChange={(e) => setCloudConfig(prev => ({
                        ...prev,
                        aws: {
                          ...prev.aws,
                          authMethod: e.target.value,
                          // Clear method-specific fields when switching
                          ...(e.target.value === 'identity-center' ? {
                            accountId: '',
                            oidcIssuerUrl: '',
                            oidcAudience: 'sts.amazonaws.com',
                            oidcSubject: ''
                          } : {}),
                          ...(e.target.value === 'oidc' ? {
                            accessKey: '',
                            secretKey: '',
                            sessionToken: ''
                          } : {})
                        }
                      }))}
                      className="form-control"
                    >
                      <option value="identity-center">AWS Identity Center (SSO)</option>
                      <option value="oidc">OIDC Federation (Kubernetes)</option>
                    </select>
                    <small className="form-text text-muted">
                      {cloudConfig.aws?.authMethod === 'identity-center' 
                        ? 'Use temporary credentials from AWS Identity Center portal'
                        : 'Use OIDC federation with Kubernetes service account tokens'
                      }
                    </small>
                  </div>
                </div>
                
                {/* Identity Center Credentials - Only show when using Identity Center */}
                {cloudConfig.aws?.authMethod !== 'oidc' && (
                  <div className="identity-center-credentials-section">
                    <div className="auth-section-header">
                      <h5><i className="fa-solid fa-key"></i> Identity Center Credentials (Required)</h5>
                      <small style={{ color: '#1976d2', fontWeight: '600' }}>
                        ℹ️ Obtain these credentials from AWS Identity Center portal - refreshed automatically by AWS SDK
                      </small>
                    </div>
                  <div className="access-key-grid">
                    <div className="config-field">
                      <label>Access Key ID (Required):</label>
                      <input
                        type="text"
                        value={cloudConfig.aws.accessKey || ''}
                        onChange={e => setCloudConfig(prev => ({
                          ...prev,
                          aws: { ...prev.aws, accessKey: e.target.value.trim() }
                        }))}
                        placeholder="ASIA... (from Identity Center)"
                        required
                      />
                      <small style={{ color: '#28a745' }}>From Identity Center portal</small>
                    </div>
                    <div className="config-field">
                      <label>Secret Access Key (Required):</label>
                      <input
                        type="password"
                        value={cloudConfig.aws.secretKey || ''}
                        onChange={e => setCloudConfig(prev => ({
                          ...prev,
                          aws: { ...prev.aws, secretKey: e.target.value.trim() }
                        }))}
                        placeholder="Secret key..."
                        required
                      />
                      <small style={{ color: '#28a745' }}>From Identity Center portal</small>
                    </div>
                    <div className="config-field session-token-field">
                      <label>Session Token (Required):</label>
                      <input
                        type="password"
                        value={cloudConfig.aws.sessionToken || ''}
                        onChange={e => setCloudConfig(prev => ({
                          ...prev,
                          aws: { ...prev.aws, sessionToken: e.target.value.trim() }
                        }))}
                        placeholder="Session token..."
                        required
                      />
                      <small style={{ color: '#28a745' }}>From Identity Center portal (12-hour expiration, auto-refresh enabled)</small>
                    </div>
                  </div>
                  <div className="auth-method-note">
                    <strong>🔑 Identity Center Authentication:</strong> All credentials obtained from AWS Identity Center portal → App assumes role → Gets fresh S3 access → User refreshes credentials from portal when expired
                  </div>
                </div>
                )}

                {/* OIDC Federation Configuration - Only show when using OIDC */}
                {cloudConfig.aws?.authMethod === 'oidc' && (
                  <div className="oidc-credentials-section">
                    <div className="auth-section-header">
                      <h5><i className="fa-solid fa-link"></i> OIDC Federation Configuration</h5>
                      <small style={{ color: '#1976d2', fontWeight: '600' }}>
                        ℹ️ Configure OIDC federation for Kubernetes service account authentication
                      </small>
                    </div>
                    <div className="access-key-grid">
                      <div className="config-field">
                        <label>AWS Account ID (Required):</label>
                        <input
                          type="text"
                          value={cloudConfig.aws?.accountId || ''}
                          onChange={e => setCloudConfig(prev => ({
                            ...prev,
                            aws: { ...prev.aws, accountId: e.target.value.trim() }
                          }))}
                          placeholder="123456789012"
                          required
                        />
                        <small style={{ color: '#28a745' }}>Your AWS account ID (12 digits)</small>
                      </div>
                      <div className="config-field">
                        <label>OIDC Issuer URL (Required):</label>
                        <input
                          type="url"
                          value={cloudConfig.aws?.oidcIssuerUrl || ''}
                          onChange={e => setCloudConfig(prev => ({
                            ...prev,
                            aws: { ...prev.aws, oidcIssuerUrl: e.target.value.trim() }
                          }))}
                          placeholder="https://oidc.ingasti.com"
                          required
                        />
                        <small style={{ color: '#28a745' }}>Kubernetes OIDC issuer URL</small>
                      </div>
                      <div className="config-field">
                        <label>OIDC Audience:</label>
                        <input
                          type="text"
                          value={cloudConfig.aws?.oidcAudience || 'sts.amazonaws.com'}
                          onChange={e => setCloudConfig(prev => ({
                            ...prev,
                            aws: { ...prev.aws, oidcAudience: e.target.value.trim() }
                          }))}
                          placeholder="sts.amazonaws.com"
                        />
                        <small style={{ color: '#28a745' }}>Token audience (usually sts.amazonaws.com)</small>
                      </div>
                      <div className="config-field">
                        <label>OIDC Subject:</label>
                        <input
                          type="text"
                          value={cloudConfig.aws?.oidcSubject || ''}
                          onChange={e => setCloudConfig(prev => ({
                            ...prev,
                            aws: { ...prev.aws, oidcSubject: e.target.value.trim() }
                          }))}
                          placeholder="system:serviceaccount:default:media-access-sa"
                        />
                        <small style={{ color: '#28a745' }}>Service account subject (format: system:serviceaccount:namespace:service-account-name)</small>
                      </div>
                    </div>
                    <div className="auth-method-note">
                      <strong>🌐 OIDC Federation:</strong> Uses Kubernetes service account tokens → AWS STS AssumeRoleWithWebIdentity → Automatic credential refresh via Kubernetes
                    </div>
                  </div>
                )}
                
                <div className="aws-config-sidebar">
                  {/* Configuration Status and Save Button */}
                  <div className="config-field">
                    {/* Status Cards Container */}
                    <div className="aws-status-cards-container">
                      {/* Debug Status Card */}
                      <div className="debug-info">
                        <strong>🔧 Configuration Status:</strong><br/>
                        • Bucket: <span style={{color: cloudConfig.aws.bucketName ? 'green' : 'red'}}>{cloudConfig.aws.bucketName || 'MISSING'}</span><br/>
                        • Region: <span style={{color: cloudConfig.aws.region ? 'green' : 'red'}}>{cloudConfig.aws.region || 'MISSING'}</span><br/>
                        • Role ARN: <span style={{color: cloudConfig.aws.roleArn ? 'green' : 'red'}}>{cloudConfig.aws.roleArn ? 'SET ✅' : 'MISSING ❌'}</span><br/>
                        {/* Only show External ID for non-OIDC authentication */}
                        {cloudConfig.aws.authMethod !== 'oidc' && (
                          <>• External ID: <span style={{color: cloudConfig.aws.externalId ? 'green' : 'red'}}>{cloudConfig.aws.externalId ? 'SET ✅' : 'MISSING ❌'}</span><br/></>
                        )}
                        {cloudConfig.aws.authMethod === 'oidc' ? (
                          <>
                            • Auth Method: <span style={{color: 'purple'}}>OIDC Web Identity 🌐</span><br/>
                            • OIDC Issuer: <span style={{color: cloudConfig.aws.oidcIssuerUrl ? 'green' : 'red'}}>{cloudConfig.aws.oidcIssuerUrl ? 'SET ✅' : 'MISSING ❌'}</span><br/>
                            • OIDC Subject: <span style={{color: cloudConfig.aws.oidcSubject ? 'green' : 'red'}}>{cloudConfig.aws.oidcSubject ? 'SET ✅' : 'MISSING ❌'}</span><br/>
                          </>
                        ) : cloudConfig.aws.authMethod === 'sso' ? (
                          <>
                            • Auth Method: <span style={{color: 'blue'}}>AWS SSO (Identity Center) 🔐</span><br/>
                            • Manual Credentials: <span style={{color: 'red'}}>MISSING ❌</span>
                          </>
                        ) : (
                          <>
                            • Access Key: <span style={{color: cloudConfig.aws.accessKey ? 'green' : 'red'}}>{cloudConfig.aws.accessKey ? 'SET ✅' : 'REQUIRED ❌'}</span><br/>
                            • Secret Key: <span style={{color: cloudConfig.aws.secretKey ? 'green' : 'red'}}>{cloudConfig.aws.secretKey ? 'SET ✅' : 'REQUIRED ❌'}</span><br/>
                            • Session Token: <span style={{color: cloudConfig.aws.sessionToken ? 'green' : 'red'}}>{cloudConfig.aws.sessionToken ? 'SET ✅' : 'REQUIRED ❌'}</span>
                          </>
                        )}
                      </div>

                      {/* Credential Status Card - Only for Identity Center */}
                      {credentialStatus && cloudConfig.aws?.authMethod !== 'oidc' && (
                        <div className="debug-info" style={{backgroundColor: !credentialStatus.credentialsValid ? '#ffe6e6' : credentialStatus.statusLevel === 'WARNING' ? '#fff3cd' : '#e6ffe6'}}>
                          <strong>🔑 Credential Status:</strong><br/>
                          • Status: <span style={{color: !credentialStatus.credentialsValid ? 'red' : credentialStatus.statusLevel === 'WARNING' ? 'orange' : 'green'}}>
                            {!credentialStatus.credentialsValid ? 'EXPIRED ❌' : credentialStatus.statusLevel === 'WARNING' ? 'EXPIRING SOON ⚠️' : 'VALID ✅'}
                          </span><br/>
                          {credentialStatus.error && (
                            <>• Error: <span style={{color: 'red', fontSize: '0.9em'}}>
                              {credentialStatus.error}
                            </span><br/></>
                          )}
                          • Auto-refresh: <span style={{color: credentialStatus.autoRefresh ? 'green' : 'red'}}>
                            {credentialStatus.autoRefresh ? 'ACTIVE ✅' : 'INACTIVE ❌'}
                          </span>
                        </div>
                      )}

                      {/* Credentials Expired Warning - Only show for Identity Center authentication */}
                      {credentialStatus && !credentialStatus.credentialsValid && cloudConfig.aws.authMethod !== 'oidc' && cloudConfig.aws.authMethod !== 'sso' && (
                        <div className="debug-info" style={{backgroundColor: '#ffebee', border: '2px solid #f44336', borderRadius: '8px', padding: '15px', margin: '10px 0'}}>
                          <strong style={{color: '#d32f2f'}}>⚠️ ACTION REQUIRED: Credentials Expired</strong><br/>
                          <p style={{margin: '10px 0', fontSize: '14px'}}>
                            AWS Identity Center credentials expire every 12 hours and cannot be automatically renewed. 
                            You need to get fresh credentials from the AWS Identity Center portal.
                          </p>
                          <div style={{backgroundColor: '#fff', padding: '10px', borderRadius: '4px', margin: '10px 0'}}>
                            <strong>Steps to fix:</strong><br/>
                            1. Go to AWS Identity Center portal<br/>
                            2. Copy the new Access Key ID, Secret Access Key, and Session Token<br/>
                            3. Paste them into the fields above<br/>
                            4. Click "Test Connection" then "Save Configuration"
                          </div>
                        </div>
                      )}

                      {/* Configuration Complete Notice */}
                      <div className="aws-security-info">
                        <h5>✅ Configuration Complete</h5>
                        <p>
                          All AWS S3 settings are configured. Test connection first, then save to activate secure cloud storage.
                        </p>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="action-buttons">
                      {/* Test Connection Button - Regular AWS or OIDC */}
                      {cloudConfig.aws.authMethod !== 'oidc' ? (
                        <button 
                          className="btn-test-connection"
                          onClick={testAwsConnection}
                          disabled={!isAwsAuthValid()}
                          style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: '2px solid #0056b3',
                            fontSize: '14px',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            width: '100%',
                            marginBottom: '10px',
                            opacity: !isAwsAuthValid() ? 0.5 : 1
                          }}
                        >
                          <i className="fa-solid fa-plug"></i> Test Connection
                        </button>
                      ) : (
                        <button 
                          className="btn-test-oidc-connection"
                          onClick={testOidcConnection}
                          disabled={!isAwsAuthValid()}
                          style={{
                            backgroundColor: '#8B5CF6',
                            color: 'white',
                            border: '2px solid #7C3AED',
                            fontSize: '14px',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            width: '100%',
                            marginBottom: '10px',
                            opacity: !isAwsAuthValid() ? 0.5 : 1
                          }}
                        >
                          <i className="fa-solid fa-globe"></i> Test OIDC Configuration
                        </button>
                      )}

                      {/* Only show Refresh Credentials for Identity Center authentication */}
                      {cloudConfig.aws.authMethod !== 'oidc' && (
                        <button 
                          className="btn-refresh-credentials"
                          onClick={refreshAwsCredentials}
                          disabled={loading}
                          style={{
                            backgroundColor: '#fd7e14',
                            color: 'white',
                            border: '2px solid #e55100',
                            fontSize: '14px',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            width: '100%',
                            marginBottom: '10px'
                          }}
                        >
                          <i className="fa-solid fa-refresh"></i> Refresh Credentials
                        </button>
                      )}
                      
                      <button 
                        className="btn-save-config"
                        onClick={saveAwsConfiguration}
                        disabled={!isAwsAuthValid()}
                        style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: '2px solid #1e7e34',
                          fontSize: '14px',
                          padding: '10px 20px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          width: '100%',
                          opacity: !isAwsAuthValid() ? 0.5 : 1
                        }}
                      >
                        <i className="fa-solid fa-save"></i> Save Configuration
                      </button>
                      
                      {/* Sync S3 Button - Only for Identity Center authentication */}
                      {cloudConfig.aws?.authMethod !== 'oidc' && (
                        <button 
                          className="btn-sync-s3"
                          onClick={syncS3WithDatabase}
                          disabled={mediaServerType !== 'aws'}
                          style={{
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: '2px solid #138496',
                            fontSize: '14px',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            width: '100%',
                            opacity: mediaServerType !== 'aws' ? 0.5 : 1,
                            marginTop: '10px'
                          }}
                          title="Sync S3 bucket files with database records"
                        >
                          <i className="fa-solid fa-sync"></i> Sync S3 to Database
                        </button>
                      )}

                      {/* OIDC Sync S3 Button - Only for OIDC authentication */}
                      {cloudConfig.aws?.authMethod === 'oidc' && (
                        <button 
                          className="btn-sync-s3-oidc"
                          onClick={syncS3WithOIDC}
                          disabled={mediaServerType !== 'aws'}
                          style={{
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: '2px solid #1e7e34',
                            fontSize: '14px',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            width: '100%',
                            opacity: mediaServerType !== 'aws' ? 0.5 : 1,
                            marginTop: '10px'
                          }}
                          title="Sync S3 bucket files with database using OIDC authentication"
                        >
                          <i className="fa-solid fa-sync"></i> Sync S3 to Database (OIDC)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mediaServerType === 'aws' && (
            <div className="media-server-status">
              <div className="status-item">
                <i className="fa-solid fa-lock"></i>
                <span><strong>Private Access Only:</strong> S3 bucket configured with private access and authorized policies only</span>
              </div>
              <div className="status-item">
                <i className="fa-solid fa-users-gear"></i>
                <span><strong>Organization SSO:</strong> Uses AWS Organizations with Identity Center - no IAM users created</span>
              </div>
              <div className="status-item">
                <i className="fa-solid fa-key"></i>
                <span><strong>IAM Role Security:</strong> Temporary credentials via STS AssumeRole for enhanced security</span>
              </div>
            </div>
          )}
          
          {mediaServerType === 'external' && (
            <div className="external-media-server-url">
              <label>External Media Server URL:</label>
              <input
                type="url"
                value={externalMediaServerUrl}
                onChange={e => setExternalMediaServerUrl(e.target.value)}
                placeholder="https://mediaserver.example.com/api"
              />
              <div className="media-server-warning">
                <small style={{ color: 'orange' }}>
                  External media server integration is not yet implemented. Please use internal server for now.
                </small>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Media</h3>
              <button onClick={() => setShowUploadModal(false)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="upload-area">
                <input
                  type="file"
                  id="media-upload"
                  multiple
                  accept="image/*,video/*,.pdf"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  style={{ display: 'none' }}
                />
                <label htmlFor="media-upload" className="upload-label">
                  <i className="fa-solid fa-cloud-upload"></i>
                  <p>Click to select files or drag and drop</p>
                  <small>Supported: Images, Videos, PDFs (Max 10MB each)</small>
                </label>
              </div>
              {uploading && (
                <div className="upload-progress">
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  <span>Uploading files...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="modal-overlay" onClick={() => setShowCreateFolder(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Folder</h3>
              <button onClick={() => setShowCreateFolder(false)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="folder-input"
              />
              <div className="modal-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => setShowCreateFolder(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary"
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                >
                  Create Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move File Modal */}
      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Move File</h3>
              <button onClick={() => setShowMoveModal(null)}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>Move <strong>{showMoveModal.filename}</strong> to:</p>
              <select 
                className="folder-select"
                onChange={(e) => {
                  if (e.target.value && confirm(`Move ${showMoveModal.filename} to ${e.target.value}?`)) {
                    handleMoveFile(showMoveModal.id, e.target.value);
                  }
                }}
                defaultValue=""
              >
                <option value="">Select destination folder...</option>
                {folders.map(folder => (
                  <option 
                    key={folder.path} 
                    value={folder.path}
                    disabled={folder.path === currentFolder}
                  >
                    {folder.path === '/' ? 'Root' : folder.name}
                  </option>
                ))}
              </select>
              <div className="modal-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => setShowMoveModal(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
