import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getDbPool } from '../config/database.js';
import CoreDB from './CoreDB.js';

// AWS SSO Configuration for Blog
const AWS_CONFIG = {
  accountId: '007041844937',
  roleName: 'BlogMediaLibraryAccess',
  region: 'eu-west-2',
  bucketName: 'bedtimeblog-medialibrary'
};

class AWSCredentialRefresh {
  constructor() {
    this.isRefreshing = false;
    this.refreshInterval = null;
  }

  /**
   * Extract credentials from AWS SSO cache
   */
  async extractSSOCredentials() {
    try {
      console.log('🔍 Extracting AWS SSO credentials...');

      // Find SSO cache file
      const cacheDir = path.join(process.env.HOME || '/root', '.aws/sso/cache');
      
      if (!fs.existsSync(cacheDir)) {
        throw new Error('AWS SSO cache directory not found. Run "aws sso login" first.');
      }

      // Find cache file with startUrl
      const cacheFiles = fs.readdirSync(cacheDir);
      let accessToken = null;

      for (const file of cacheFiles) {
        try {
          const filePath = path.join(cacheDir, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          if (content.startUrl && content.accessToken) {
            accessToken = content.accessToken;
            break;
          }
        } catch (e) {
          // Skip invalid cache files
          continue;
        }
      }

      if (!accessToken) {
        throw new Error('No valid SSO access token found. Run "aws sso login" first.');
      }

      // Get role credentials using access token
      const credsCommand = `aws sso get-role-credentials --account-id ${AWS_CONFIG.accountId} --role-name ${AWS_CONFIG.roleName} --region ${AWS_CONFIG.region} --access-token ${accessToken} --output json`;
      
      const credsOutput = execSync(credsCommand, { encoding: 'utf8' });
      const credentials = JSON.parse(credsOutput);

      if (!credentials.roleCredentials) {
        throw new Error('Failed to extract role credentials from AWS SSO');
      }

      const creds = credentials.roleCredentials;
      
      return {
        accessKey: creds.accessKeyId,
        secretKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
        expiresAt: new Date(creds.expiration),
        region: AWS_CONFIG.region,
        bucketName: AWS_CONFIG.bucketName
      };

    } catch (error) {
      console.error('❌ Error extracting SSO credentials:', error.message);
      throw error;
    }
  }

  /**
   * Update credentials in database
   */
  async updateDatabaseCredentials(credentials) {
    try {
      const pool = getDbPool();
      
      const awsConfig = {
        accessKey: credentials.accessKey,
        secretKey: credentials.secretKey,
        sessionToken: credentials.sessionToken,
        region: credentials.region,
        bucketName: credentials.bucketName,
        expiresAt: credentials.expiresAt.toISOString(),
        lastRefresh: new Date().toISOString()
      };

      await CoreDB.setConfig('aws.config', awsConfig, 'json', 'aws', 'AWS configuration including credentials');

      console.log('✅ AWS credentials updated in CoreDB');
      console.log(`📅 New expiration: ${credentials.expiresAt.toISOString()}`);
      
      return true;
    } catch (error) {
      console.error('❌ Error updating database credentials:', error);
      throw error;
    }
  }

  /**
   * Check if credentials need refresh (30 minutes before expiration)
   */
  async needsRefresh() {
    try {
      const awsConfigValue = await CoreDB.getConfig('aws.config');
      
      if (!awsConfigValue) {
        console.log('⚠️ No AWS config found - refresh needed');
        return true;
      }

      const config = typeof awsConfigValue === 'string' ? JSON.parse(awsConfigValue) : awsConfigValue;
      
      if (!config.expiresAt) {
        console.log('⚠️ No expiration date found - refresh needed');
        return true;
      }

      const expiresAt = new Date(config.expiresAt);
      const now = new Date();
      const refreshTime = new Date(expiresAt.getTime() - (30 * 60 * 1000)); // 30 minutes before

      const needsRefresh = now >= refreshTime;
      
      if (needsRefresh) {
        console.log(`🔄 Credentials need refresh (expire at ${expiresAt.toISOString()})`);
      } else {
        console.log(`✅ Credentials still valid until ${expiresAt.toISOString()}`);
      }

      return needsRefresh;
    } catch (error) {
      console.error('❌ Error checking credential status:', error);
      return true; // Refresh on error to be safe
    }
  }

  /**
   * Perform credential refresh
   */
  async refresh() {
    if (this.isRefreshing) {
      console.log('⏳ Credential refresh already in progress...');
      return { success: false, message: 'Refresh already in progress' };
    }

    this.isRefreshing = true;

    try {
      console.log('🔄 Starting AWS credential refresh...');

      // Extract new credentials from SSO
      const credentials = await this.extractSSOCredentials();
      
      // Update database
      await this.updateDatabaseCredentials(credentials);
      
      console.log('✅ AWS credential refresh completed successfully');
      
      return { 
        success: true, 
        message: 'Credentials refreshed successfully',
        expiresAt: credentials.expiresAt.toISOString()
      };

    } catch (error) {
      console.error('❌ AWS credential refresh failed:', error);
      
      return { 
        success: false, 
        message: error.message,
        error: error.toString()
      };
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Start automatic refresh monitoring
   */
  startAutoRefresh() {
    console.log('🚀 Starting AWS credential auto-refresh monitoring...');
    
    // Check every 15 minutes
    this.refreshInterval = setInterval(async () => {
      try {
        if (await this.needsRefresh()) {
          console.log('🔄 Auto-refresh triggered');
          await this.refresh();
        }
      } catch (error) {
        console.error('❌ Auto-refresh check failed:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    // Also check immediately on startup
    setTimeout(async () => {
      try {
        if (await this.needsRefresh()) {
          console.log('🔄 Initial refresh check triggered');
          await this.refresh();
        }
      } catch (error) {
        console.error('❌ Initial refresh check failed:', error);
      }
    }, 5000); // 5 seconds after startup
  }

  /**
   * Stop automatic refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('⏹️ AWS credential auto-refresh stopped');
    }
  }

  /**
   * Get current credential status
   */
  async getStatus() {
    try {
      const awsConfigValue = await CoreDB.getConfig('aws.config');
      
      if (!awsConfigValue) {
        return { 
          status: 'missing', 
          message: 'No AWS configuration found' 
        };
      }

      const config = typeof awsConfigValue === 'string' ? JSON.parse(awsConfigValue) : awsConfigValue;
      
      if (!config.expiresAt) {
        return { 
          status: 'invalid', 
          message: 'No expiration date found' 
        };
      }

      const expiresAt = new Date(config.expiresAt);
      const now = new Date();
      const expired = now >= expiresAt;
      const needsRefresh = await this.needsRefresh();

      return {
        status: expired ? 'expired' : needsRefresh ? 'expiring-soon' : 'valid',
        expiresAt: expiresAt.toISOString(),
        lastRefresh: config.lastRefresh || 'unknown',
        timeUntilExpiry: Math.max(0, Math.floor((expiresAt - now) / 1000 / 60)), // minutes
        accountId: AWS_CONFIG.accountId,
        roleName: AWS_CONFIG.roleName,
        bucketName: config.bucketName
      };
    } catch (error) {
      return { 
        status: 'error', 
        message: error.message 
      };
    }
  }
}

// Export singleton instance
export const awsCredentialRefresh = new AWSCredentialRefresh();
export default awsCredentialRefresh;