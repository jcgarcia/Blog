import { STSClient, AssumeRoleCommand, AssumeRoleWithWebIdentityCommand } from '@aws-sdk/client-sts';
import { SSOClient, GetRoleCredentialsCommand } from '@aws-sdk/client-sso';
import { SSOOIDCClient, CreateTokenCommand, StartDeviceAuthorizationCommand } from '@aws-sdk/client-sso-oidc';
import { S3Client } from '@aws-sdk/client-s3';
import { fromSSO, fromWebToken, fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { getDbPool } from '../db.js';
import CoreDB from './CoreDB.js';
import crypto from 'crypto';

class AWSCredentialManager {
  constructor() {
    this.s3Client = null;
    this.credentialProvider = null;
    this.isInitialized = false;
    this.refreshTimer = null;
  }

  /**
   * Initialize automatic credential provider using AWS SDK's built-in refresh
   */
  async initializeCredentialProvider() {
    try {
      console.log('🔄 Initializing AWS SDK automatic credential provider...');
      
      const config = await this.getStoredAWSConfig();
      if (!config) {
        throw new Error('No AWS configuration found in database');
      }

      // Debug: Log the config to see what we're working with
      console.log('🔍 AWS Config loaded from CoreDB:', JSON.stringify(config, null, 2));
      console.log('🔍 Config keys:', Object.keys(config));
      console.log('🔍 authMethod:', config.authMethod);
      console.log('🔍 roleArn:', config.roleArn);
      console.log('🔍 oidcSubject:', config.oidcSubject);

      let credentialProvider;

      // Method 1: Use OIDC Web Identity Token if configured (Kubernetes service account)
      if (config.authMethod === 'oidc' && config.roleArn && config.oidcSubject) {
        console.log('🔑 OIDC configuration detected - implementing native OIDC authentication');
        
        // Try to read Kubernetes service account token
        try {
          const { readFileSync } = await import('fs');
          const tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token';
          const serviceAccountToken = readFileSync(tokenPath, 'utf8');
          
          console.log('✅ Kubernetes service account token found, using for OIDC authentication');
          console.log('🎯 This provides permanent authentication without credential refresh');
          
          // Use the service account token with AWS Web Identity Token credentials
          credentialProvider = fromWebToken({
            roleArn: config.roleArn,
            webIdentityToken: serviceAccountToken,
            roleSessionName: 'BedtimeBlog-OIDC-Session',
            durationSeconds: 3600, // 1 hour, will auto-refresh
            roleAssumerWithWebIdentity: async (params) => {
              const stsClient = new STSClient({ region: config.region || 'eu-west-2' });
              return stsClient.send(new AssumeRoleWithWebIdentityCommand(params));
            }
          });
          
          console.log('🚀 Native OIDC authentication initialized - no manual refresh required');
          
        } catch (tokenError) {
          // If we can't read the service account token, we're probably not in Kubernetes
          console.log('⚠️ Cannot read Kubernetes service account token:', tokenError.message);
          console.log('📍 This likely means we are not running in a Kubernetes environment');
          
          // In non-Kubernetes environments, OIDC cannot work without proper token
          throw new Error(`OIDC authentication requires Kubernetes service account token. Current environment: ${tokenError.message}. Deploy to Kubernetes cluster with proper service account configuration.`);
        }
      }
      // Method 2: Use Identity Center credentials if available (new format or temp format)
      else {
        const accessKey = config.accessKeyId || config.tempAccessKey;
        const secretKey = config.secretKey || config.tempSecretKey;
        const sessionToken = config.sessionToken || config.tempSessionToken;
        
        if (accessKey && secretKey && sessionToken) {
          console.log('🔑 Using Identity Center credentials');
          credentialProvider = async () => ({
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
            sessionToken: sessionToken,
            expiration: new Date(Date.now() + 12 * 60 * 60 * 1000) // Default 12 hours from now
          });
        }
        // Method 3: Use SSO if configured and no temp credentials
        else if (config.ssoStartUrl && config.ssoRegion && config.ssoAccountId && config.ssoRoleName) {
          console.log('🔑 Using AWS SSO credential provider (auto-refresh enabled)');
          credentialProvider = fromSSO({
            ssoStartUrl: config.ssoStartUrl,
            ssoRegion: config.ssoRegion,
            ssoAccountId: config.ssoAccountId,
            ssoRoleName: config.ssoRoleName,
            clientName: 'BedtimeBlog-MediaManager'
          });
        }
        // Method 4: Use role assumption with auto-refresh
        else if (config.roleArn && config.accessKey && config.secretKey) {
          console.log('🔑 Using role assumption with auto-refresh');
          credentialProvider = fromTemporaryCredentials({
            masterCredentials: {
              accessKeyId: config.accessKey,
              secretAccessKey: config.secretKey,
              ...(config.sessionToken && { sessionToken: config.sessionToken })
            },
            params: {
              RoleArn: config.roleArn,
              RoleSessionName: 'BedtimeBlog-MediaManager',
              DurationSeconds: 3600, // 1 hour
              ...(config.externalId && { ExternalId: config.externalId })
            },
            // The SDK will automatically refresh 5 minutes before expiration
          });
        }
        // Method 5: Use direct credentials with custom refresh logic
        else if (config.accessKey && config.secretKey) {
          console.log('🔑 Using direct credentials with custom refresh wrapper');
          credentialProvider = this.createRefreshableCredentialProvider(config);
        }
        else {
          throw new Error('Insufficient AWS configuration for automatic credential provider');
        }
      }

      // Create S3 client with the credential provider
      // CRITICAL: Force standard S3 signing to avoid AWS SDK v3.906.0 S3Express bug
      this.s3Client = new S3Client({
        region: config.region || 'eu-west-2',
        credentials: credentialProvider,
        // Force standard S3 endpoint to prevent S3Express detection
        endpoint: `https://s3.${config.region || 'eu-west-2'}.amazonaws.com`,
        forcePathStyle: false,
        // CRITICAL: Override signing behavior to use standard v4 signing
        signingName: 's3', // Force service name to 's3' not 's3express'
        signingRegion: config.region || 'eu-west-2',
        // Use existing signature version to prevent Express middleware
        signatureVersion: 'v4',
        // Additional configuration to prevent S3Express
        useAccelerateEndpoint: false,
        bucketEndpoint: false,
        // Force standard behavior 
        disableHostPrefix: false
      });

      // HACK: Remove S3 Express middleware if it was added
      try {
        if (this.s3Client.middlewareStack && this.s3Client.middlewareStack.remove) {
          // Try to remove S3 Express middleware if present
          const middlewareNames = ['s3ExpressMiddleware', 'S3ExpressMiddleware', 's3Express'];
          middlewareNames.forEach(name => {
            try {
              this.s3Client.middlewareStack.remove(name);
            } catch (e) {
              // Middleware not found, ignore
            }
          });
        }
      } catch (middlewareError) {
        console.log('⚠️ Could not modify middleware stack:', middlewareError.message);
      }

      this.credentialProvider = credentialProvider;
      this.isInitialized = true;

      // Show different messages based on authentication method
      if (config.authMethod === 'oidc' && config.roleArn && config.oidcSubject) {
        console.log('✅ OIDC Web Identity provider initialized successfully');
        console.log('🔄 Kubernetes service account tokens will be automatically rotated');
        return {
          success: true,
          message: 'OIDC Web Identity provider initialized',
          autoRefresh: true,
          tokenManagement: 'Kubernetes'
        };
      } else {
        console.log('✅ AWS SDK automatic credential provider initialized successfully');
        console.log('📋 Credentials will be automatically refreshed by AWS SDK');
        return {
          success: true,
          message: 'AWS SDK automatic credential provider initialized',
          autoRefresh: true
        };
      }

    } catch (error) {
      console.error('❌ Failed to initialize credential provider:', error.message);
      throw error;
    }
  }

  /**
   * Create a refreshable credential provider for Identity Center credentials
   */
  createRefreshableCredentialProvider(config) {
    // Set up proactive refresh timer
    this.setupProactiveRefresh(config);
    
    const refreshFunction = async () => {
      try {
        console.log('🔄 AWS SDK triggered credential refresh...');
        
        // Get latest config from database (in case it was updated)
        const latestConfig = await this.getStoredAWSConfig();
        if (!latestConfig || !latestConfig.accessKey || !latestConfig.secretKey) {
          throw new Error('No valid credentials in database. Please update in Operations Panel.');
        }
        
        // Check if Identity Center credentials are about to expire
        if (latestConfig.expiresAt) {
          const expirationTime = new Date(latestConfig.expiresAt);
          const timeUntilExpiry = expirationTime.getTime() - Date.now();
          const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60);
          
          if (hoursUntilExpiry < 0.5) { // Less than 30 minutes
            console.warn('⚠️ Identity Center credentials expire in less than 30 minutes!');
            console.warn('🔔 ACTION REQUIRED: Please refresh credentials in Operations Panel soon');
          }
        }

        // If we have role assumption configured, use STS to get new credentials
        if (latestConfig.roleArn && latestConfig.externalId) {
          console.log('🎭 Refreshing credentials via role assumption...');
          
          const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts');
          
          const stsClient = new STSClient({
            region: latestConfig.region || 'eu-west-2',
            credentials: {
              accessKeyId: latestConfig.accessKey,
              secretAccessKey: latestConfig.secretKey,
              ...(latestConfig.sessionToken && { sessionToken: latestConfig.sessionToken })
            }
          });
          
          const assumeRoleCommand = new AssumeRoleCommand({
            RoleArn: latestConfig.roleArn,
            RoleSessionName: 'BedtimeBlog-AutoRefresh',
            DurationSeconds: 3600, // 1 hour
            ExternalId: latestConfig.externalId
          });
          
          const assumeRoleResponse = await stsClient.send(assumeRoleCommand);
          
          const newCredentials = {
            accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
            secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
            sessionToken: assumeRoleResponse.Credentials.SessionToken,
            expiration: assumeRoleResponse.Credentials.Expiration
          };
          
          // Update database with new credentials
          await this.updateCredentialsInDatabase({
            ...latestConfig,
            accessKey: newCredentials.accessKeyId,
            secretKey: newCredentials.secretAccessKey,
            sessionToken: newCredentials.sessionToken,
            lastRefresh: new Date().toISOString(),
            expiresAt: newCredentials.expiration.toISOString()
          });
          
          console.log('✅ AWS SDK credential refresh completed and database updated');
          return newCredentials;
          
        } else {
          // For direct credentials, return as-is but update last refresh time
          const credentials = {
            accessKeyId: latestConfig.accessKey,
            secretAccessKey: latestConfig.secretKey,
            ...(latestConfig.sessionToken && { sessionToken: latestConfig.sessionToken }),
            // Set expiration to 30 minutes from now to trigger frequent refreshes
            expiration: new Date(Date.now() + (30 * 60 * 1000)) // 30 minutes from now
          };
          
          // Update last refresh time in database
          await this.updateCredentialsInDatabase({
            ...latestConfig,
            lastRefresh: new Date().toISOString()
          });
          
          console.log('✅ AWS SDK credential refresh completed (30-minute cycle)');
          return credentials;
        }

      } catch (error) {
        console.error('❌ AWS SDK credential refresh failed:', error.message);
        
        // If it's an Identity Center expiration, provide helpful message
        if (error.message.includes('No valid credentials')) {
          console.error('🔔 ACTION REQUIRED: Please update Identity Center credentials in Operations Panel');
          throw new Error('Identity Center credentials expired. Please refresh in Operations Panel.');
        }
        
        throw error;
      }
    };

    // Return a credential provider function that AWS SDK can use
    return async () => {
      return await refreshFunction();
    };
  }

  /**
   * Get S3 client with automatic credential refresh
   */
  async getS3Client() {
    if (!this.isInitialized) {
      await this.initializeCredentialProvider();
    }
    return this.s3Client;
  }

  /**
   * Get credentials (SDK handles refresh automatically, checks for auto-refresh updates)
   */
  async getCredentials() {
    if (!this.isInitialized) {
      await this.initializeCredentialProvider();
    }

    try {
      // For OIDC, check if auto-refresh service has updated credentials in CoreDB
      const config = await this.getStoredAWSConfig();
      if (config && config.authMethod === 'oidc' && config.expiresAt) {
        const expirationTime = new Date(config.expiresAt);
        const timeUntilExpiry = expirationTime.getTime() - Date.now();
        
        // If credentials were recently refreshed by the auto-refresh service, use them directly
        if (config.sessionToken && timeUntilExpiry > 0) {
          console.log('✅ Using OIDC credentials from auto-refresh service');
          return {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            sessionToken: config.sessionToken,
            expiration: expirationTime
          };
        }
      }
      
      // Get credentials from provider
      const credentials = await this.credentialProvider();
      // Check authentication method for appropriate messaging
      if (config && config.authMethod === 'oidc') {
        console.log('✅ OIDC tokens obtained (Kubernetes service account token active)');
      } else {
        console.log('✅ Credentials obtained (AWS SDK auto-refresh active)');
      }
      return credentials;
    } catch (error) {
      console.error('❌ Failed to get credentials:', error.message);
      // Try to reinitialize if credentials failed
      if (
        error.message.includes('expired') ||
        error.message.includes('invalid') ||
        error.message.includes('ExpiredTokenException') ||
        error.message.includes('Token too old')
      ) {
        console.log('🔄 Attempting to reinitialize credential provider due to expired/invalid OIDC token...');
        this.isInitialized = false;
        await this.initializeCredentialProvider();
        return await this.credentialProvider();
      }
      throw error;
    }
  }

  /**
   * Force reinitialize credential provider (for configuration changes)
   */
  async reinitialize() {
    console.log('🔄 Force reinitializing credential provider...');
    this.isInitialized = false;
    this.s3Client = null;
    this.credentialProvider = null;
    return await this.initializeCredentialProvider();
  }

  /**
   * Get credential status with AWS SDK integration
   */
  async getStatus() {
    try {
      const config = await this.getStoredAWSConfig();
      let status = {
        configured: !!config,
        initialized: this.isInitialized,
        autoRefresh: true, // AWS SDK handles this
        sdkManaged: true,
        lastCheck: new Date().toISOString()
      };

      if (this.isInitialized && this.credentialProvider) {
        try {
          // Test credentials by calling the provider
          const credentials = await this.credentialProvider();
          status.credentialsValid = true;
          status.hasExpiration = !!credentials.expiration;
          
          if (credentials.expiration) {
            const timeUntilExpiry = new Date(credentials.expiration).getTime() - Date.now();
            status.timeUntilExpiry = timeUntilExpiry;
            status.timeUntilExpiryMinutes = Math.floor(timeUntilExpiry / 60000);
            status.isNearExpiry = timeUntilExpiry <= 300000; // Within 5 minutes
          }
          
        } catch (credError) {
          status.credentialsValid = false;
          status.error = credError.message;
        }
      }

      // Determine authentication method
      if (config) {
        const hasAccessKey = config.accessKeyId || config.tempAccessKey;
        const hasSecretKey = config.secretKey || config.tempSecretKey;
        const hasSessionToken = config.sessionToken || config.tempSessionToken;
        
        // CRITICAL: Check for OIDC first before other role-based methods
        if (config.authMethod === 'oidc' && config.roleArn && config.oidcSubject) {
          status.authMethod = 'OIDC Web Identity (Kubernetes)';
        } else if (hasAccessKey && hasSecretKey && hasSessionToken) {
          status.authMethod = 'Identity Center Credentials';
        } else if (config.ssoStartUrl) {
          status.authMethod = 'AWS SSO (Identity Center)';
        } else if (config.roleArn) {
          status.authMethod = 'IAM Role Assumption';
        } else {
          status.authMethod = 'Direct IAM Credentials';
        }
      }

      return status;

    } catch (error) {
      return {
        configured: false,
        initialized: false,
        error: error.message,
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Test credentials by making an actual AWS call
   */
  async testCredentials() {
    try {
      const s3Client = await this.getS3Client();
      
      // Make a simple call to test credentials
      const { STSClient, GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
      const stsClient = new STSClient({
        region: 'eu-west-2',
        credentials: this.credentialProvider
      });
      
      const command = new GetCallerIdentityCommand({});
      const response = await stsClient.send(command);
      
      return {
        success: true,
        message: 'Credentials are valid and working',
        identity: {
          arn: response.Arn,
          userId: response.UserId,
          account: response.Account
        }
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Credential test failed',
        error: error.message
      };
    }
  }

  /**
   * Get AWS configuration from database
   */
  async getStoredAWSConfig() {
    try {
      const awsConfigValue = await CoreDB.getConfig('aws.config');
      
      if (!awsConfigValue) {
        return null;
      }

      // If value is already an object, return it directly
      if (typeof awsConfigValue === 'object' && awsConfigValue !== null) {
        return awsConfigValue;
      }
      
      // If value is a string, parse it as JSON
      if (typeof awsConfigValue === 'string') {
        return JSON.parse(awsConfigValue);
      }
      
      // Fallback: log the type and return null
      console.error('Unexpected value type for aws_config:', typeof value, value);
      return null;
    } catch (error) {
      console.error('Error fetching AWS config from database:', error);
      return null;
    }
  }

  /**
   * Update AWS configuration and reinitialize
   */
  async updateConfiguration(newConfig) {
    try {
      const pool = getDbPool();
      
      // Store new configuration in CoreDB
      await CoreDB.setConfig('aws.config', newConfig, 'json', 'aws', 'AWS S3 storage configuration with OIDC');
      
      // Reinitialize with new configuration
      await this.reinitialize();
      
      console.log('✅ AWS configuration updated and credential provider reinitialized');
      
      return {
        success: true,
        message: 'Configuration updated and automatic refresh reinitialized'
      };
      
    } catch (error) {
      console.error('❌ Failed to update configuration:', error.message);
      throw error;
    }
  }

  /**
   * Update credentials in database (for automatic refresh)
   */
  async updateCredentialsInDatabase(updatedConfig) {
    try {
      const pool = getDbPool();
      
      // Store updated configuration with new credentials in CoreDB
      await CoreDB.setConfig('aws.config', updatedConfig, 'json', 'aws', 'AWS S3 storage configuration with OIDC');
      
      console.log('✅ AWS credentials updated in database');
      
    } catch (error) {
      console.error('❌ Failed to update credentials in database:', error.message);
      throw error;
    }
  }

  /**
   * Setup proactive refresh timer to avoid expiration
   */
  setupProactiveRefresh(config) {
    // Clear any existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    // Set up a timer to check credentials every 15 minutes
    this.refreshTimer = setInterval(async () => {
      try {
        const latestConfig = await this.getStoredAWSConfig();
        if (!latestConfig || !latestConfig.expiresAt) return;
        
        const expirationTime = new Date(latestConfig.expiresAt);
        const timeUntilExpiry = expirationTime.getTime() - Date.now();
        const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60);
        
        // If less than 2 hours until expiry, log a warning
        if (hoursUntilExpiry < 2 && hoursUntilExpiry > 0) {
          console.warn(`⚠️ Identity Center credentials expire in ${Math.round(hoursUntilExpiry * 60)} minutes`);
          console.warn('🔔 Consider refreshing credentials in Operations Panel soon');
        }
        
        // If less than 30 minutes until expiry, force reinitialize
        if (hoursUntilExpiry < 0.5 && hoursUntilExpiry > 0) {
          console.warn('🚨 URGENT: Credentials expire in less than 30 minutes - attempting refresh');
          try {
            await this.reinitialize();
          } catch (refreshError) {
            console.error('❌ Automatic refresh failed:', refreshError.message);
          }
        }
        
      } catch (error) {
        console.error('❌ Proactive refresh check failed:', error.message);
      }
    }, 15 * 60 * 1000); // Check every 15 minutes
    
    console.log('⏰ Proactive credential refresh timer started (15-minute intervals)');
  }

  /**
   * Initialize AWS SSO session using stored configuration
   * This attempts to use the existing SSO configuration to establish a session
   */
  async initializeSSOSession() {
    try {
      console.log('🔑 Attempting to establish AWS SSO session...');
      
      const config = await this.getStoredAWSConfig();
      if (!config || !config.ssoStartUrl || !config.ssoRegion || !config.ssoAccountId || !config.ssoRoleName) {
        throw new Error('SSO configuration incomplete. Missing required SSO parameters.');
      }

      console.log('✅ SSO configuration found:', {
        startUrl: config.ssoStartUrl,
        region: config.ssoRegion,
        accountId: config.ssoAccountId,
        roleName: config.ssoRoleName
      });

      // Try to initialize the credential provider with SSO
      await this.initializeCredentialProvider();
      
      // Test if credentials are working
      const credentials = await this.credentialProvider();
      if (credentials && credentials.accessKeyId) {
        console.log('✅ SSO session established successfully');
        return {
          success: true,
          message: 'SSO session established successfully',
          action: 'SSO_SESSION_ACTIVE'
        };
      } else {
        throw new Error('SSO session could not be established - credentials not available');
      }

    } catch (error) {
      console.error('❌ SSO session establishment failed:', error.message);
      
      // Return user-friendly instructions for manual SSO setup
      return {
        success: false,
        action: 'MANUAL_SSO_REQUIRED',
        message: 'SSO session needs to be established manually on the server',
        instructions: [
          'The AWS SSO session needs to be established on the server side.',
          'This typically requires server-side AWS CLI configuration:',
          '1. Run: aws configure sso',
          '2. Enter your SSO Start URL (configured in admin panel)',
          '3. Enter your SSO Region (configured in admin panel)', 
          '4. Select your AWS account (configured in admin panel)',
          '5. Select your IAM role (configured in admin panel)',
          'Alternative: Use temporary credentials from AWS Identity Center portal'
        ],
        technicalError: error.message
      };
    }
  }

  /**
   * Force refresh of SSO credentials
   * This reinitializes the credential provider to pick up any changes
   */
  async refreshSSOCredentials() {
    try {
      console.log('🔄 Refreshing SSO credentials...');
      
      // Clear current credential provider
      this.credentialProvider = null;
      this.isInitialized = false;
      
      // Reinitialize
      await this.initializeCredentialProvider();
      
      console.log('✅ SSO credentials refreshed successfully');
      return {
        success: true,
        message: 'SSO credentials refreshed successfully',
        action: 'CREDENTIALS_REFRESHED'
      };
      
    } catch (error) {
      console.error('❌ Failed to refresh SSO credentials:', error.message);
      throw new Error(`SSO credential refresh failed: ${error.message}`);
    }
  }
}

// Singleton instance with automatic initialization
const credentialManager = new AWSCredentialManager();

// Initialize on startup
credentialManager.initializeCredentialProvider().catch(error => {
  console.warn('⚠️ Could not initialize credential provider on startup:', error.message);
  console.warn('🔔 Credentials will be initialized on first use');
});

export default credentialManager;
