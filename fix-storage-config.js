#!/usr/bin/env node

import SystemConfigManager from './api/utils/systemConfig.js';

async function fixStorageConfig() {
  const config = new SystemConfigManager();
  
  try {
    console.log('🔧 Setting media storage type to AWS...');
    await config.setConfig('media_storage_type', 'aws', 'string', 'Media storage type configuration');
    
    console.log('🔧 Setting AWS configuration...');
    const awsConfig = {
      bucketName: "bedtimeblog-medialibrary",
      region: "eu-west-2",
      authMethod: "oidc",
      roleArn: "arn:aws:iam::007041844937:role/BedtimeBlogMediaRole",
      accountId: "007041844937",
      oidcIssuerUrl: "https://oidc.ingasti.com",
      oidcAudience: "https://oidc.ingasti.com",
      oidcSubject: "system:serviceaccount:blog:media-account"
    };
    
    await config.setConfig('aws_config', JSON.stringify(awsConfig), 'json', 'AWS S3 configuration for media storage');
    
    console.log('✅ Configuration updated successfully in DataDB!');
    
    // Verify the configuration
    console.log('🔍 Verifying configuration...');
    const storageType = await config.getConfig('media_storage_type');
    const awsConfigRead = await config.getConfig('aws_config');
    
    console.log('Storage type:', storageType);
    console.log('AWS config:', awsConfigRead ? 'SET' : 'MISSING');
    
  } catch (error) {
    console.error('❌ Error updating configuration:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

fixStorageConfig();