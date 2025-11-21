import { STSClient, AssumeRoleWithWebIdentityCommand } from '@aws-sdk/client-sts';
import { readFileSync } from 'fs';
import CoreDB from './CoreDB.js';

/**
 * OIDC Credential Refresh Service
 * 
 * Automatically refreshes AWS credentials using Kubernetes OIDC service account tokens
 * to prevent credential expiration (credentials expire after 1 hour by default).
 * 
 * This service:
 * - Reads the Kubernetes service account token from the mounted secret
 * - Calls AWS STS AssumeRoleWithWebIdentity to get temporary credentials
 * - Updates CoreDB with the new credentials
 * - Runs on a 45-minute interval to refresh before the 60-minute expiration
 */
class OidcCredentialRefreshService {
  constructor() {
    this.refreshInterval = null;
    this.refreshIntervalMs = 45 * 60 * 1000; // 45 minutes (refresh before 60-minute expiration)
    this.tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
    this.isRunning = false;
    this.lastRefreshTime = null;
    this.lastRefreshStatus = null;
    this.nextRefreshTime = null;
    
    // AWS configuration from environment or CoreDB
    this.config = {
      region: process.env.AWS_REGION || 'us-east-1',
      roleArn: process.env.AWS_ROLE_ARN,
    };
  }

  /**
   * Start the automatic credential refresh service
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  OIDC credential refresh service is already running');
      return;
    }

    try {
      // Validate configuration
      if (!this.config.roleArn) {
        console.warn('⚠️  AWS_ROLE_ARN not configured - OIDC refresh service disabled');
        return;
      }

      console.log('🚀 Starting OIDC credential auto-refresh service...');
      console.log(`   Role ARN: ${this.config.roleArn}`);
      console.log(`   Refresh interval: ${this.refreshIntervalMs / 60000} minutes`);

      // Do initial refresh
      await this.refreshCredentials();

      // Set up automatic refresh
      this.refreshInterval = setInterval(async () => {
        await this.refreshCredentials();
      }, this.refreshIntervalMs);

      this.isRunning = true;
      this.nextRefreshTime = new Date(Date.now() + this.refreshIntervalMs);
      
      console.log('✅ OIDC credential auto-refresh service initialized');
      console.log(`   Next refresh scheduled for: ${this.nextRefreshTime.toISOString()}`);
    } catch (error) {
      console.error('❌ Failed to start OIDC credential refresh service:', error);
      this.lastRefreshStatus = 'failed';
      throw error;
    }
  }

  /**
   * Stop the automatic credential refresh service
   */
  stop() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      this.isRunning = false;
      this.nextRefreshTime = null;
      console.log('🛑 OIDC credential auto-refresh service stopped');
    }
  }

  /**
   * Refresh AWS credentials using OIDC
   */
  async refreshCredentials() {
    try {
      console.log('🔄 Refreshing AWS credentials via OIDC...');

      // Read the Kubernetes service account token
      const serviceAccountToken = readFileSync(this.tokenPath, 'utf8');
      
      if (!serviceAccountToken) {
        throw new Error('Service account token not found');
      }

      // Create STS client
      const stsClient = new STSClient({ region: this.config.region });

      // Assume role with web identity
      const command = new AssumeRoleWithWebIdentityCommand({
        RoleArn: this.config.roleArn,
        RoleSessionName: 'BedtimeBlog-OIDC-AutoRefresh',
        WebIdentityToken: serviceAccountToken,
        DurationSeconds: 3600 // 1 hour (maximum for OIDC)
      });

      const response = await stsClient.send(command);

      if (!response.Credentials) {
        throw new Error('No credentials returned from STS');
      }

      // Update CoreDB with new credentials
      await CoreDB.set('AWS_ACCESS_KEY_ID', response.Credentials.AccessKeyId);
      await CoreDB.set('AWS_SECRET_ACCESS_KEY', response.Credentials.SecretAccessKey);
      await CoreDB.set('AWS_SESSION_TOKEN', response.Credentials.SessionToken);
      await CoreDB.set('AWS_CREDENTIAL_EXPIRATION', response.Credentials.Expiration.toISOString());

      this.lastRefreshTime = new Date();
      this.lastRefreshStatus = 'success';
      this.nextRefreshTime = new Date(Date.now() + this.refreshIntervalMs);

      console.log('✅ AWS credentials refreshed successfully via OIDC');
      console.log(`   Expires at: ${response.Credentials.Expiration.toISOString()}`);
      console.log(`   Next refresh: ${this.nextRefreshTime.toISOString()}`);

      return {
        success: true,
        expiresAt: response.Credentials.Expiration.toISOString(),
        refreshedAt: this.lastRefreshTime.toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to refresh AWS credentials via OIDC:', error);
      this.lastRefreshStatus = 'failed';
      throw error;
    }
  }

  /**
   * Get current service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRefreshTime: this.lastRefreshTime ? this.lastRefreshTime.toISOString() : null,
      lastRefreshStatus: this.lastRefreshStatus,
      nextRefreshTime: this.nextRefreshTime ? this.nextRefreshTime.toISOString() : null,
      refreshIntervalMinutes: this.refreshIntervalMs / 60000,
      roleArn: this.config.roleArn
    };
  }
}

// Export singleton instance
export default new OidcCredentialRefreshService();
