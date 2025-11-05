import { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import credentialManager from './awsCredentialManager.js';
import { promisify } from 'util';
import { exec } from 'child_process';
import { databaseManager } from '../db.js';
import CoreDB from './CoreDB.js';

const execAsync = promisify(exec);

/**
 * Backup Storage Service
 * Handles scheduled database backups with S3 storage and retention management
 * Separate from media library - uses dedicated 'backups/' prefix
 */
class BackupStorageService {
  constructor() {
    this.bucketName = null;
    this.s3Client = null;
    this.backupPrefix = 'database-backups/'; // Separate from media files
    this.maxBackups = 10;
    this.maxAgeInDays = 30;
  }

  /**
   * Initialize the backup service with S3 configuration
   */
  async initialize() {
    try {
      console.log('🔧 Initializing BackupStorageService...');
      
      // Get S3 configuration from CoreDB
      const coreDB = CoreDB.getInstance();
      const s3Config = await coreDB.getConfig('aws.s3') || {};
      
      this.bucketName = s3Config.bucket_name;
      if (!this.bucketName) {
        throw new Error('S3 bucket name not configured in CoreDB');
      }

      // Use existing S3 client from credential manager (OIDC-enabled)
      this.s3Client = await credentialManager.getS3Client();

      console.log('✅ BackupStorageService initialized successfully');
      console.log(`📦 Using bucket: ${this.bucketName}`);
      console.log(`📁 Backup prefix: ${this.backupPrefix}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize BackupStorageService:', error);
      throw error;
    }
  }

  /**
   * Create a database backup and upload to S3
   * @param {string} backupType - Type of backup (scheduled, manual, etc.)
   * @returns {Promise<Object>} Backup information
   */
  async createAndUploadBackup(backupType = 'scheduled') {
    try {
      if (!this.s3Client) {
        await this.initialize();
      }

      console.log(`🔄 Creating ${backupType} database backup...`);
      
      // Get active database connection from DatabaseManager
      const activeConnection = databaseManager.getActiveConnection();
      if (!activeConnection) {
        throw new Error('No active database connection configured');
      }

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${activeConnection.database}-${timestamp}.sql`;
      const s3Key = `${this.backupPrefix}${filename}`;

      // Create pg_dump command
      const dumpCommand = [
        'pg_dump',
        `--host=${activeConnection.host}`,
        `--port=${activeConnection.port}`,
        `--username=${activeConnection.username}`,
        `--dbname=${activeConnection.database}`,
        '--verbose',
        '--clean',
        '--no-owner',
        '--no-privileges',
        '--format=plain'
      ].join(' ');

      console.log(`📊 Executing backup command for database: ${activeConnection.database}`);
      
      // Set password environment variable
      const env = {
        ...process.env,
        PGPASSWORD: activeConnection.password
      };

      // Execute pg_dump and capture output
      const { stdout, stderr } = await execAsync(dumpCommand, { 
        env,
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large databases
      });

      if (stderr && !stderr.includes('NOTICE:')) {
        console.warn('⚠️ pg_dump warnings:', stderr);
      }

      // Upload to S3
      console.log(`📤 Uploading backup to S3: ${s3Key}`);
      
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: stdout,
        ContentType: 'application/sql',
        Metadata: {
          'backup-type': backupType,
          'database-name': activeConnection.database,
          'created-at': new Date().toISOString(),
          'backup-size': Buffer.byteLength(stdout, 'utf8').toString()
        },
        ServerSideEncryption: 'AES256' // Encrypt at rest
      });

      const uploadResult = await this.s3Client.send(uploadCommand);
      
      const backupInfo = {
        filename,
        s3Key,
        size: Buffer.byteLength(stdout, 'utf8'),
        createdAt: new Date().toISOString(),
        backupType,
        database: activeConnection.database,
        etag: uploadResult.ETag
      };

      console.log('✅ Database backup created and uploaded successfully');
      console.log(`📦 Backup size: ${(backupInfo.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Clean up old backups after successful upload
      await this.cleanupOldBackups();
      
      return backupInfo;
      
    } catch (error) {
      console.error('❌ Failed to create and upload backup:', error);
      throw error;
    }
  }

  /**
   * List all backups stored in S3
   * @returns {Promise<Array>} List of backup information
   */
  async listBackups() {
    try {
      if (!this.s3Client) {
        await this.initialize();
      }

      console.log('📋 Listing database backups from S3...');
      
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.backupPrefix,
        MaxKeys: 100 // Should be more than enough for retention policy
      });

      const response = await this.s3Client.send(listCommand);
      
      if (!response.Contents || response.Contents.length === 0) {
        return [];
      }

      // Process and sort backups by date (newest first)
      const backups = response.Contents
        .filter(obj => obj.Key.endsWith('.sql'))
        .map(obj => ({
          filename: obj.Key.replace(this.backupPrefix, ''),
          s3Key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          etag: obj.ETag
        }))
        .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

      console.log(`📊 Found ${backups.length} backups in S3`);
      return backups;
      
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      throw error;
    }
  }

  /**
   * Delete a specific backup from S3
   * @param {string} s3Key - S3 key of the backup to delete
   */
  async deleteBackup(s3Key) {
    try {
      if (!this.s3Client) {
        await this.initialize();
      }

      console.log(`🗑️ Deleting backup: ${s3Key}`);
      
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      await this.s3Client.send(deleteCommand);
      console.log('✅ Backup deleted successfully');
      
    } catch (error) {
      console.error('❌ Failed to delete backup:', error);
      throw error;
    }
  }

  /**
   * Clean up old backups based on retention policy
   * Keeps last 10 backups and removes anything older than 30 days
   */
  async cleanupOldBackups() {
    try {
      console.log('🧹 Running backup cleanup...');
      
      const backups = await this.listBackups();
      if (backups.length === 0) {
        console.log('📋 No backups to clean up');
        return;
      }

      const now = new Date();
      const maxAge = new Date(now.getTime() - (this.maxAgeInDays * 24 * 60 * 60 * 1000));
      
      // Find backups to delete
      const toDelete = [];
      
      // Delete backups beyond the retention count (keep last 10)
      if (backups.length > this.maxBackups) {
        const excessBackups = backups.slice(this.maxBackups);
        toDelete.push(...excessBackups);
        console.log(`📊 ${excessBackups.length} backups exceed retention count (${this.maxBackups})`);
      }
      
      // Delete backups older than maxAge (30 days)
      const oldBackups = backups.filter(backup => 
        new Date(backup.lastModified) < maxAge && 
        !toDelete.find(b => b.s3Key === backup.s3Key)
      );
      toDelete.push(...oldBackups);
      
      if (oldBackups.length > 0) {
        console.log(`📊 ${oldBackups.length} backups are older than ${this.maxAgeInDays} days`);
      }

      if (toDelete.length === 0) {
        console.log('✅ No backups need cleanup');
        return;
      }

      // Delete identified backups
      console.log(`🗑️ Deleting ${toDelete.length} old backups...`);
      
      for (const backup of toDelete) {
        try {
          await this.deleteBackup(backup.s3Key);
          console.log(`✅ Deleted: ${backup.filename}`);
        } catch (error) {
          console.error(`❌ Failed to delete ${backup.filename}:`, error.message);
        }
      }
      
      console.log(`✅ Cleanup completed. Deleted ${toDelete.length} old backups`);
      
    } catch (error) {
      console.error('❌ Backup cleanup failed:', error);
      // Don't throw - cleanup failures shouldn't break backup creation
    }
  }

  /**
   * Generate a signed URL for downloading a backup
   * @param {string} s3Key - S3 key of the backup
   * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} Signed download URL
   */
  async generateDownloadUrl(s3Key, expiresIn = 3600) {
    try {
      if (!this.s3Client) {
        await this.initialize();
      }

      console.log(`🔗 Generating download URL for: ${s3Key}`);
      
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const signedUrl = await getSignedUrl(this.s3Client, getCommand, { expiresIn });
      console.log('✅ Download URL generated successfully');
      
      return signedUrl;
      
    } catch (error) {
      console.error('❌ Failed to generate download URL:', error);
      throw error;
    }
  }

  /**
   * Get backup statistics and health information
   * @returns {Promise<Object>} Backup statistics
   */
  async getBackupStats() {
    try {
      const backups = await this.listBackups();
      
      const stats = {
        totalBackups: backups.length,
        totalSize: backups.reduce((sum, backup) => sum + (backup.size || 0), 0),
        latestBackup: backups[0] || null,
        oldestBackup: backups[backups.length - 1] || null,
        withinRetentionPolicy: backups.length <= this.maxBackups,
        retentionPolicy: {
          maxBackups: this.maxBackups,
          maxAgeInDays: this.maxAgeInDays,
          currentCount: backups.length
        }
      };
      
      return stats;
      
    } catch (error) {
      console.error('❌ Failed to get backup stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
const backupStorageService = new BackupStorageService();
export default backupStorageService;