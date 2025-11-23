// Manual S3 sync script to populate database with S3 bucket contents
import { getDbPool } from './api/db.js';
import credentialManager from './api/services/awsCredentialManager.js';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

async function syncS3WithDatabase() {
  try {
    console.log('🔄 Starting manual S3 database sync...');
    
    const pool = getDbPool();
    const s3Client = await credentialManager.getS3Client();
    const bucketName = 'bedtimeblog-medialibrary';
    const defaultUserId = 1; // Admin user ID
    
    // List all objects in S3 bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'uploads/', // Only sync files in uploads folder
    });
    
    console.log('📡 Fetching S3 objects...');
    const response = await s3Client.send(listCommand);
    
    if (!response.Contents || response.Contents.length === 0) {
      console.log('📂 S3 bucket is empty, nothing to sync');
      return { syncedCount: 0, updatedCount: 0, totalProcessed: 0 };
    }
    
    console.log(`📦 Found ${response.Contents.length} objects in S3`);
    
    let syncedCount = 0;
    let updatedCount = 0;
    
    for (const s3Object of response.Contents) {
      try {
        // Skip folders (objects ending with /)
        if (s3Object.Key.endsWith('/')) {
          console.log(`📁 Skipping folder: ${s3Object.Key}`);
          continue;
        }
        
        console.log(`🔍 Processing: ${s3Object.Key}`);
        
        // Extract file info
        const fileName = s3Object.Key.split('/').pop();
        const filePath = s3Object.Key.replace('uploads/', '');
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
        const mimeType = getMimeType(fileExtension);
        const isImage = mimeType.startsWith('image/');
        
        // Determine folder
        let folderName = 'Root';
        const pathParts = filePath.split('/');
        if (pathParts.length > 1) {
          folderName = pathParts[0];
          // Capitalize folder name
          folderName = folderName.charAt(0).toUpperCase() + folderName.slice(1);
        }
        
        // Check if file already exists in database
        const existingFile = await pool.query(
          'SELECT id FROM media WHERE s3_key = $1',
          [s3Object.Key]
        );
        
        if (existingFile.rows.length > 0) {
          console.log(`✅ File already exists in database: ${fileName}`);
          updatedCount++;
          continue;
        }
        
        // Insert new file record
        const insertResult = await pool.query(`
          INSERT INTO media (
            filename, original_name, s3_key, file_size, mime_type, 
            folder, uploaded_by, file_path, is_image, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          RETURNING id
        `, [
          fileName,
          fileName,
          s3Object.Key,
          s3Object.Size || 0,
          mimeType,
          folderName,
          defaultUserId,
          filePath,
          isImage
        ]);
        
        if (insertResult.rows.length > 0) {
          syncedCount++;
          console.log(`✅ Synced: ${s3Object.Key}`);
        }
        
      } catch (syncError) {
        console.error(`❌ Failed to sync ${s3Object.Key}:`, syncError.message);
        continue;
      }
    }
    
    console.log(`🎉 S3 sync completed: ${syncedCount} new files added, ${updatedCount} existing files found`);
    console.log(`📊 Total processed: ${syncedCount + updatedCount} files`);
    
    return {
      success: true,
      syncedCount,
      updatedCount,
      totalProcessed: syncedCount + updatedCount
    };
    
  } catch (error) {
    console.error('❌ S3 sync failed:', error);
    throw error;
  }
}

// Helper function to determine MIME type
function getMimeType(extension) {
  const mimeTypes = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    
    // Videos
    'mp4': 'video/mp4',
    'avi': 'video/avi',
    'mov': 'video/quicktime',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

// Run the sync
syncS3WithDatabase()
  .then(result => {
    console.log('✅ Sync completed successfully:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  });