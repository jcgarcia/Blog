import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getDbPool } from '../db.js';
import awsCredentialManager from '../services/awsCredentialManager.js';
import CoreDB from '../services/CoreDB.js';

// Sync S3 bucket contents with database
export const syncS3ToDatabase = async (req, res) => {
  try {
    const pool = getDbPool();
    
    // Get AWS configuration from CoreDB
    const mediaStorageType = await CoreDB.getConfig('media.storage_type');
    const awsConfigValue = await CoreDB.getConfig('aws.config');
    
    const settings = {
      media_storage_type: mediaStorageType,
      aws_config: typeof awsConfigValue === 'string' ? JSON.parse(awsConfigValue) : awsConfigValue
    };

    if (settings.media_storage_type !== 'aws' || !settings.aws_config?.bucketName) {
      return res.status(400).json({
        success: false,
        message: 'AWS S3 not configured'
      });
    }

    // Get S3 client using OIDC authentication
    const credentials = await awsCredentialManager.getCredentials();
    const s3Client = new S3Client({
      region: settings.aws_config.region || 'eu-west-2',
      credentials
    });
    const bucketName = settings.aws_config.bucketName;

    // List all objects in S3 bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'uploads/' // Only sync files in uploads folder
    });

    const s3Objects = await s3Client.send(listCommand);
    
    if (!s3Objects.Contents || s3Objects.Contents.length === 0) {
      return res.json({
        success: true,
        message: 'No files found in S3 bucket',
        synced: 0
      });
    }

    // Get existing files from database
    const existingFiles = await pool.query('SELECT s3_key FROM media');
    const existingKeys = new Set(existingFiles.rows.map(row => row.s3_key));

    let syncedCount = 0;
    const syncResults = [];

    // Process each S3 object
    for (const obj of s3Objects.Contents) {
      if (existingKeys.has(obj.Key)) {
        syncResults.push({
          key: obj.Key,
          status: 'already_exists',
          message: 'File already in database'
        });
        continue;
      }

      try {
        // Extract filename from S3 key (e.g., "uploads/2025-09-03/file.png" -> "file.png")
        const pathParts = obj.Key.split('/');
        const filename = pathParts[pathParts.length - 1];
        
        // Try to extract original name (remove hash if present)
        let originalName = filename;
        const hashMatch = filename.match(/^(.+)-[a-f0-9]{8}\.(.+)$/);
        if (hashMatch) {
          originalName = `${hashMatch[1]}.${hashMatch[2]}`;
        }

        // Determine MIME type from extension
        const extension = filename.split('.').pop().toLowerCase();
        let mimeType = 'application/octet-stream';
        let fileType = extension;
        
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
          mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
        } else if (['mp4', 'webm', 'mov'].includes(extension)) {
          mimeType = `video/${extension}`;
        } else if (['mp3', 'wav', 'ogg'].includes(extension)) {
          mimeType = `audio/${extension}`;
        } else if (['pdf'].includes(extension)) {
          mimeType = 'application/pdf';
        }

        // Insert into database
        const insertQuery = `
          INSERT INTO media (
            filename, original_name, file_type, file_size, s3_key, s3_bucket,
            public_url, folder_path, tags, alt_text, uploaded_by, mime_type,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id
        `;

        const values = [
          filename,                                    // filename
          originalName,                               // original_name
          fileType,                                   // file_type
          obj.Size.toString(),                        // file_size
          obj.Key,                                    // s3_key
          bucketName,                                 // s3_bucket
          'private://s3-signed-url-required',         // public_url (placeholder for private bucket)
          '/',                                        // folder_path
          [],                                         // tags
          '',                                         // alt_text
          req.adminUser?.id || 1,                     // uploaded_by (fallback to admin user)
          mimeType,                                   // mime_type
          obj.LastModified || new Date(),             // created_at
          obj.LastModified || new Date()              // updated_at
        ];

        const result = await pool.query(insertQuery, values);
        
        syncedCount++;
        syncResults.push({
          key: obj.Key,
          status: 'synced',
          message: `Added to database with ID ${result.rows[0].id}`,
          filename: filename,
          originalName: originalName,
          size: obj.Size
        });

      } catch (error) {
        console.error(`Error syncing ${obj.Key}:`, error);
        syncResults.push({
          key: obj.Key,
          status: 'error',
          message: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Sync completed. ${syncedCount} files added to database.`,
      synced: syncedCount,
      total: s3Objects.Contents.length,
      results: syncResults
    });

  } catch (error) {
    console.error('S3 sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync S3 bucket with database',
      error: error.message
    });
  }
};

// OIDC-specific S3 sync function
export const syncS3ToDatabaseOIDC = async (req, res) => {
  try {
    console.log('🔄 OIDC Sync Phase 1: Starting OIDC S3 sync...');
    const pool = getDbPool();
    
    // Get AWS configuration from CoreDB
    console.log('🔄 OIDC Sync Phase 2: Retrieving AWS config from CoreDB...');
    const awsConfigValue = await CoreDB.getConfig('aws.config');
    if (!awsConfigValue) {
      console.error('❌ Phase 2 Failed: AWS configuration not found in CoreDB');
      return res.status(400).json({
        success: false,
        message: 'AWS configuration not found in CoreDB'
      });
    }

    let awsConfig;
    console.log('🔍 Raw AWS config value type:', typeof awsConfigValue);
    console.log('🔍 Raw AWS config value:', awsConfigValue);
    
    try {
      // Handle both string and object formats
      if (typeof awsConfigValue === 'object' && awsConfigValue !== null) {
        awsConfig = awsConfigValue;
      } else if (typeof awsConfigValue === 'string') {
        // Only parse if it's actually a JSON string
        if (awsConfigValue.startsWith('{') || awsConfigValue.startsWith('[')) {
          awsConfig = JSON.parse(awsConfigValue);
        } else {
          throw new Error(`Invalid JSON format: ${awsConfigValue}`);
        }
      } else {
        throw new Error(`Unexpected value type: ${typeof rawValue}`);
      }
    } catch (e) {
      console.error('❌ Phase 2 Failed: AWS config parsing error:', e.message);
      return res.status(400).json({
        success: false,
        message: `Invalid AWS configuration format: ${e.message}`
      });
    }
    console.log('✅ Phase 2 Complete: AWS config parsed:', { bucketName: awsConfig.bucketName, region: awsConfig.region });

    if (!awsConfig.bucketName) {
      console.error('❌ Phase 2 Failed: S3 bucket name not configured');
      return res.status(400).json({
        success: false,
        message: 'S3 bucket name not configured'
      });
    }

    // Get S3 client using OIDC authentication
    console.log('� OIDC Sync Phase 3: Getting OIDC credentials...');
    const rawCredentials = await awsCredentialManager.getCredentials();
    console.log('✅ OIDC credentials obtained');
    console.log('🔍 Raw credential object keys:', Object.keys(rawCredentials));
    
    // Handle OIDC Web Identity Token response structure (same as working media.js)
    let accessKeyId, secretAccessKey, sessionToken;
    
    if (rawCredentials.Credentials) {
      // OIDC Web Identity Token response structure
      accessKeyId = rawCredentials.Credentials.AccessKeyId;
      secretAccessKey = rawCredentials.Credentials.SecretAccessKey;
      sessionToken = rawCredentials.Credentials.SessionToken;
      console.log('🔍 Using OIDC Web Identity credential structure (Credentials.AccessKeyId)');
    } else if (rawCredentials.credentials) {
      // Nested credentials object (lowercase)
      const creds = rawCredentials.credentials;
      accessKeyId = creds.AccessKeyId || creds.accessKeyId;
      secretAccessKey = creds.SecretAccessKey || creds.secretAccessKey;
      sessionToken = creds.SessionToken || creds.sessionToken;
      console.log('🔍 Using nested credentials object');
    } else if (rawCredentials.accessKeyId || rawCredentials.AccessKeyId) {
      // Direct credential structure
      accessKeyId = rawCredentials.accessKeyId || rawCredentials.AccessKeyId;
      secretAccessKey = rawCredentials.secretAccessKey || rawCredentials.SecretAccessKey;
      sessionToken = rawCredentials.sessionToken || rawCredentials.SessionToken;
      console.log('🔍 Using direct credential structure');
    } else {
      console.error('❌ Phase 3 Failed: Unable to find AWS credentials in object. Available properties:', Object.keys(rawCredentials).join(', '));
      throw new Error(`Unable to find AWS credentials in object. Available properties: ${Object.keys(rawCredentials).join(', ')}`);
    }
    
    // Validate extracted credentials
    if (!accessKeyId || !secretAccessKey || !sessionToken) {
      console.error('❌ Phase 3 Failed: Credential validation failed:', {
        hasAccessKeyId: !!accessKeyId,
        hasSecretAccessKey: !!secretAccessKey,
        hasSessionToken: !!sessionToken
      });
      throw new Error(`Invalid credentials: missing ${!accessKeyId ? 'accessKeyId' : !secretAccessKey ? 'secretAccessKey' : 'sessionToken'}`);
    }
    
    console.log('✅ Phase 3 Complete: Credentials extracted successfully');

    console.log('🔄 OIDC Sync Phase 4: Creating S3 client...');
    const s3Client = new S3Client({
      region: awsConfig.region || 'eu-west-2',
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken
      }
    });
    const bucketName = awsConfig.bucketName;
    console.log('✅ Phase 4 Complete: S3 client created for bucket:', bucketName);

    // List all objects in S3 bucket
    console.log('🔄 OIDC Sync Phase 5: Listing S3 objects...');
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'uploads/' // Only sync files in uploads folder
    });

    const s3Objects = await s3Client.send(listCommand);
    console.log('✅ Phase 5 Complete: S3 objects retrieved:', s3Objects.Contents?.length || 0, 'objects found');
    
    if (!s3Objects.Contents || s3Objects.Contents.length === 0) {
      console.log('ℹ️ No files found in S3 bucket - sync complete');
      return res.json({
        success: true,
        message: 'No files found in S3 bucket',
        synced: 0
      });
    }

    // Get existing files from database
    console.log('🔄 OIDC Sync Phase 6: Checking existing database entries...');
    const existingFiles = await pool.query('SELECT s3_key FROM media');
    const existingKeys = new Set(existingFiles.rows.map(row => row.s3_key));
    console.log('🔍 Found', existingKeys.size, 'existing files in database');

    console.log('🔄 OIDC Sync Phase 7: Fixing existing media entries...');
    
    // First, fix existing records with NULL file_type to prevent JavaScript crashes
    await pool.query(`
      UPDATE media 
      SET file_type = CASE 
        WHEN mime_type LIKE 'image/%' THEN SUBSTRING(filename FROM '\.([^.]+)$')
        WHEN mime_type = 'application/pdf' THEN 'pdf'
        WHEN mime_type LIKE 'video/%' THEN SUBSTRING(filename FROM '\.([^.]+)$')
        ELSE 'unknown'
      END
      WHERE file_type IS NULL
    `);
    console.log('✅ Phase 7a: Fixed existing NULL file_type values');
    
    // Fix media_folders table - replace Thumbnails with Videos  
    console.log('🔄 Phase 7b: Fixing media folders structure...');
    await pool.query(`
      UPDATE media_folders SET name = 'Videos', path = '/videos', description = 'Video files' 
      WHERE name = 'Thumbnails' OR path = '/thumbnails'
    `);
    console.log('✅ Phase 7b: Media folders structure fixed');
    
    // Now clear for fresh sync
    await pool.query('DELETE FROM media');
    console.log('✅ Phase 7c: Existing media entries cleared for fresh sync');
    
    console.log('🔄 OIDC Sync Phase 7c: Processing S3 objects for database insertion...');
    let syncedCount = 0;
    const insertPromises = [];

    for (const obj of s3Objects.Contents) {
      console.log('🔍 Processing file:', obj.Key);
        
        // Extract filename from S3 key
        const filename = obj.Key.split('/').pop();
        const originalName = filename;
        
        // Determine mime type based on file extension
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        let mimeType = 'application/octet-stream';
        let folderPath = '/'; // Default to root
        
        if (['jpg', 'jpeg'].includes(ext)) {
          mimeType = 'image/jpeg';
          folderPath = '/images';
        } else if (ext === 'png') {
          mimeType = 'image/png';
          folderPath = '/images';
        } else if (ext === 'gif') {
          mimeType = 'image/gif';
          folderPath = '/images';
        } else if (ext === 'webp') {
          mimeType = 'image/webp';
          folderPath = '/images';
        } else if (ext === 'pdf') {
          mimeType = 'application/pdf';
          folderPath = '/documents';
        } else if (['mp4', 'mov'].includes(ext) && ext) {
          mimeType = `video/${ext}`;
          folderPath = '/videos';
        }

        console.log('🔍 Preparing insert for:', {
          filename,
          originalName,
          mimeType,
          size: obj.Size,
          folderPath,
          s3Key: obj.Key
        });

        const insertPromise = pool.query(`
          INSERT INTO media (
            filename, original_name, file_path, file_size, mime_type, file_type,
            s3_key, s3_bucket, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          filename || 'unknown',
          originalName || filename || 'unknown',
          folderPath + '/' + filename, // Use categorized folder path
          obj.Size || 0,
          mimeType || 'application/octet-stream',
          ext || 'unknown', // Add file_type field
          obj.Key || '',
          bucketName || ''
        ]);

        insertPromises.push(insertPromise);
        syncedCount++;
    }

    console.log('🔄 OIDC Sync Phase 8: Executing database inserts...', syncedCount, 'new files to insert');
    // Execute all inserts
    if (insertPromises.length > 0) {
      await Promise.all(insertPromises);
      console.log('✅ Phase 8 Complete: Database inserts completed successfully');
    } else {
      console.log('ℹ️ Phase 8 Skipped: No new files to insert');
    }

    console.log('✅ OIDC Sync Complete: Success!');
    res.json({
      success: true,
      message: `OIDC sync completed successfully`,
      synced: syncedCount,
      total: s3Objects.Contents.length
    });

  } catch (error) {
    console.error('❌ OIDC S3 Sync Error at phase:', error.message);
    console.error('❌ Error name:', error.name, 'message:', error.message);
    console.error('❌ Full error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: `OIDC S3 sync failed: ${error.message}`,
      error: {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
};
