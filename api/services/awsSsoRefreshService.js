import { SSOClient, GetRoleCredentialsCommand } from "@aws-sdk/client-sso";
import { SSOOIDCClient, CreateTokenCommand } from "@aws-sdk/client-sso-oidc";
import { fromSSO } from '@aws-sdk/credential-provider-sso';
import { S3Client } from '@aws-sdk/client-s3';
import { STSClient } from '@aws-sdk/client-sts';
import { getDbPool } from '../db.js';
import CoreDB from './CoreDB.js';

class AwsSsoRefreshService {
  constructor() {
    this.refreshTimer = null;
    this.isRefreshing = false;
  }

  /**
   * Start automatic credential refresh monitoring
   */
  async startAutoRefresh() {
    console.log('🔄 Starting AWS SSO auto-refresh monitoring...');
    
    // Check immediately on startup
    await this.checkAndRefreshCredentials();
    
    // Set up interval to check every 5 minutes
    this.refreshTimer = setInterval(async () => {
      await this.checkAndRefreshCredentials();
    }, 5 * 60 * 1000); // 5 minutes
    
    console.log('✅ AWS SSO auto-refresh monitoring started');
  }

  /**
   * Stop automatic refresh monitoring
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      console.log('🛑 AWS SSO auto-refresh monitoring stopped');
    }
  }

  /**
   * Check if credentials need refresh and refresh if necessary
   */
  async checkAndRefreshCredentials() {
    if (this.isRefreshing) {
      console.log('⏳ Refresh already in progress, skipping...');
      return;
    }

    try {
      const awsConfigValue = await CoreDB.getConfig('aws.config');
      
      if (!awsConfigValue) {
        console.log('ℹ️ No AWS configuration found, skipping refresh');
        return;
      }

      const config = typeof awsConfigValue === 'string' ? JSON.parse(awsConfigValue) : awsConfigValue;
      
      // Check if auto-refresh is enabled and SSO is configured
      if (!config.autoRefreshEnabled || !config.ssoStartUrl || !config.accountId || !config.roleName) {
        console.log('ℹ️ Auto-refresh disabled or SSO not configured, skipping refresh');
        return;
      }

      // Check if credentials need refresh (refresh 30 minutes before expiration)
      if (config.expiresAt) {
        const expiresAt = new Date(config.expiresAt);
        const now = new Date();
        const thirtyMinutesFromNow = new Date(now.getTime() + (30 * 60 * 1000));
        
        if (expiresAt > thirtyMinutesFromNow) {
          console.log(`ℹ️ Credentials still valid until ${expiresAt.toISOString()}, no refresh needed`);
          return;
        }
      }

      console.log('🔄 Credentials need refresh, attempting automatic refresh...');
      await this.refreshCredentials(config);
      
    } catch (error) {
      console.error('❌ Error in auto-refresh check:', error);
    }
  }

  /**
   * Manually refresh credentials
   */
  async manualRefresh() {
    try {
      const awsConfigValue = await CoreDB.getConfig('aws.config');
      
      if (!awsConfigValue) {
        throw new Error('No AWS configuration found');
      }

      const config = typeof awsConfigValue === 'string' ? JSON.parse(awsConfigValue) : awsConfigValue;
      
      if (!config.ssoStartUrl || !config.accountId || !config.roleName) {
        throw new Error('SSO configuration incomplete. Please configure SSO settings in the media panel.');
      }

      console.log('🔄 Starting manual credential refresh...');
      const result_creds = await this.refreshCredentials(config);
      console.log('✅ Manual credential refresh completed');
      return result_creds;
      
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      throw error;
    }
  }

  /**
   * Refresh credentials using AWS SSO
   */
  async refreshCredentials(config) {
    this.isRefreshing = true;
    
    try {
      console.log('🔄 Refreshing AWS SSO credentials...');
      console.log(`📋 Using SSO: ${config.ssoStartUrl}, Account: ${config.accountId}, Role: ${config.roleName}`);
      
      // Create SSO credential provider with proper configuration
      const ssoCredentialProvider = fromSSO({
        ssoStartUrl: config.ssoStartUrl,
        ssoRegion: config.ssoRegion || 'eu-west-2',
        ssoAccountId: config.accountId,
        ssoRoleName: config.roleName,
        clientName: 'bedtime-blog-media-client'
      });

      // Get fresh credentials from AWS SSO
      const credentials = await ssoCredentialProvider();
      
      console.log('✅ Received fresh SSO credentials');
      console.log(`📅 Credentials expire at: ${credentials.expiration ? credentials.expiration.toISOString() : 'Unknown'}`);

      // Calculate proper expiration time from AWS response or default to 1 hour
      const now = new Date();
      let expiresAt;
      
      if (credentials.expiration) {
        expiresAt = credentials.expiration;
      } else {
        // Fallback: assume 1 hour expiration for SSO temporary credentials
        expiresAt = new Date(now.getTime() + (60 * 60 * 1000)); // 1 hour from now
        console.log('⚠️ No expiration provided by AWS, using 1-hour default');
      }

      // Update configuration with new temporary credentials
      const updatedConfig = {
        ...config,
        accessKey: credentials.accessKeyId,
        secretKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
        expiresAt: expiresAt.toISOString(),
        lastRefresh: now.toISOString(),
        credentialSource: 'aws-sso-temporary'
      };

      // Save to CoreDB
      await CoreDB.setConfig('aws.config', updatedConfig, 'json', 'aws', 'AWS configuration including credentials');

      console.log('✅ AWS SSO credentials refreshed and saved successfully to CoreDB');
      console.log(`ℹ️ New temporary credentials expire at: ${expiresAt.toISOString()}`);
      
      return {
        success: true,
        expiresAt: expiresAt.toISOString(),
        accessKeyId: credentials.accessKeyId,
        source: 'aws-sso-temporary',
        message: 'Temporary SSO credentials refreshed successfully'
      };
      
    } catch (error) {
      console.error('❌ Failed to refresh AWS SSO credentials:', error);
      
      // Provide helpful error messages for common SSO issues
      if (error.message.includes('token') || error.message.includes('expired')) {
        throw new Error('SSO session expired. Please run "aws sso login" on the server or re-authenticate with AWS SSO.');
      } else if (error.message.includes('profile') || error.message.includes('config')) {
        throw new Error('AWS SSO configuration error. Please ensure the SSO settings are correct.');
      } else if (error.message.includes('UnauthorizedOperation') || error.message.includes('AccessDenied')) {
        throw new Error('SSO role access denied. Please verify the account ID and role name are correct.');
      }
      
      throw new Error(`SSO credential refresh failed: ${error.message}`);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Get current credential status
   */
  async getCredentialStatus() {
    try {
      const awsConfigValue = await CoreDB.getConfig('aws.config');
      
      if (!awsConfigValue) {
        return {
          configured: false,
          message: 'No AWS configuration found'
        };
      }

      const config = typeof awsConfigValue === 'string' ? JSON.parse(awsConfigValue) : awsConfigValue;
      
      if (!config.accessKey) {
        return {
          configured: false,
          message: 'AWS credentials not configured'
        };
      }

      const now = new Date();
      let status = 'unknown';
      let timeRemaining = null;
      
      if (config.expiresAt) {
        const expiresAt = new Date(config.expiresAt);
        timeRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000 / 60)); // minutes
        
        if (expiresAt <= now) {
          status = 'expired';
        } else if (expiresAt <= new Date(now.getTime() + (30 * 60 * 1000))) {
          status = 'expiring_soon';
        } else {
          status = 'valid';
        }
      }

      return {
        configured: true,
        status,
        expiresAt: config.expiresAt,
        timeRemaining,
        autoRefreshEnabled: config.autoRefreshEnabled,
        lastRefresh: config.lastRefresh,
        ssoConfigured: !!(config.ssoStartUrl && config.accountId && config.roleName)
      };
      
    } catch (error) {
      console.error('❌ Error getting credential status:', error);
      return {
        configured: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new AwsSsoRefreshService();