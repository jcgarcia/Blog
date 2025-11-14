import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getDbPool } from '../db.js';
import CoreDB from './CoreDB.js';

/**
 * AWS SSO Credential Refresh Service
 * Automatically refreshes AWS credentials from SSO cache and updates database
 */
class AwsCredentialRefreshService {
  constructor() {
    this.accountId = '147997129378';
    this.roleName = 'Route53'; // Update this to the correct role
    this.region = 'eu-west-2';
    this.bucketName = 'bedtimeblog-medialibrary';
  }

  /**
   * Find the SSO cache file
   */
  findSsoCacheFile() {
    try {
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      const ssoDir = path.join(homeDir, '.aws', 'sso', 'cache');
      
      if (!fs.existsSync(ssoDir)) {
        throw new Error('AWS SSO cache directory not found');
      }

      const files = fs.readdirSync(ssoDir);
      for (const file of files) {
        const filePath = path.join(ssoDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);
          if (data.startUrl) {
            return filePath;
          }
        } catch (e) {
          // Skip invalid JSON files
          continue;
        }
      }
      
      throw new Error('No valid SSO cache file found');
    } catch (error) {
      throw new Error(`Failed to find SSO cache: ${error.message}`);
    }
  }

  /**
   * Extract access token from SSO cache
   */
  getAccessToken() {
    try {
      const cacheFile = this.findSsoCacheFile();
      const content = fs.readFileSync(cacheFile, 'utf8');
      const data = JSON.parse(content);
      
      if (!data.accessToken) {
        throw new Error('No access token found in cache');
      }
      
      return data.accessToken;
    } catch (error) {
      throw new Error(`Failed to get access token: ${error.message}`);
    }
  }

  /**
   * Get new credentials from AWS SSO
   */
  async getNewCredentials() {
    try {
      const accessToken = this.getAccessToken();
      
      const command = `aws sso get-role-credentials \
        --account-id "${this.accountId}" \
        --role-name "${this.roleName}" \
        --region "${this.region}" \
        --access-token "${accessToken}" \
        --output json`;
      
      const result = execSync(command, { encoding: 'utf8' });
      const data = JSON.parse(result);
      
      if (!data.roleCredentials) {
        throw new Error('No role credentials returned');
      }
      
      return {
        accessKey: data.roleCredentials.accessKeyId,
        secretKey: data.roleCredentials.secretAccessKey,
        sessionToken: data.roleCredentials.sessionToken,
        expiration: data.roleCredentials.expiration
      };
    } catch (error) {
      throw new Error(`Failed to get new credentials: ${error.message}`);
    }
  }

  /**
   * Update database with new credentials
   */
  async updateDatabase(credentials) {
    const pool = getDbPool();
    
    try {
      const awsConfig = {
        accessKey: credentials.accessKey,
        secretKey: credentials.secretKey,
        sessionToken: credentials.sessionToken,
        region: this.region,
        bucketName: this.bucketName,
        expiresAt: new Date(credentials.expiration).toISOString(),
        lastRefresh: new Date().toISOString()
      };
      
      await CoreDB.setConfig('aws.config', awsConfig, 'json', 'aws', 'AWS S3 storage configuration with OIDC');
      
      console.log('✅ AWS credentials updated in database');
      
      // Calculate expiration time
      const expiresIn = Math.floor((credentials.expiration - Date.now()) / 1000);
      const hours = Math.floor(expiresIn / 3600);
      const minutes = Math.floor((expiresIn % 3600) / 60);
      
      console.log(`⏳ Credentials expire in: ${hours}h ${minutes}m`);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to update database: ${error.message}`);
    }
  }

  /**
   * Main refresh function
   */
  async refresh() {
    try {
      console.log('🔄 Starting AWS credential refresh...');
      
      const credentials = await this.getNewCredentials();
      console.log(`🔑 New credentials obtained: ${credentials.accessKey.substring(0, 8)}...`);
      
      await this.updateDatabase(credentials);
      
      console.log('🎉 Credential refresh completed successfully!');
      return true;
    } catch (error) {
      console.error('❌ Credential refresh failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if credentials need refresh (refresh 30 minutes before expiration)
   */
  async needsRefresh() {
    const pool = getDbPool();
    
    try {
      const config = await CoreDB.getConfig('aws.config');
      
      if (!config) {
        return true; // No config exists
      }
      
      if (!config.expiresAt) {
        return true; // No expiration info
      }
      
      const expiresAt = new Date(config.expiresAt);
      const now = new Date();
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
      
      return expiresAt <= thirtyMinutesFromNow;
    } catch (error) {
      console.error('Error checking refresh status:', error);
      return true; // Refresh on error
    }
  }

  /**
   * Auto-refresh if needed
   */
  async autoRefresh() {
    try {
      const needs = await this.needsRefresh();
      if (needs) {
        console.log('🔄 Credentials need refresh, starting automatic refresh...');
        await this.refresh();
        return true;
      } else {
        console.log('✅ Credentials are still valid');
        return false;
      }
    } catch (error) {
      console.error('❌ Auto-refresh failed:', error.message);
      return false;
    }
  }
}

export default AwsCredentialRefreshService;