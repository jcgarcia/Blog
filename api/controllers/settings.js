import { getDbPool } from "../db.js";
import credentialManager from "../services/awsCredentialManager.js";
import SystemConfigManager from '../utils/systemConfigPostgreSQL.js';

const pool = getDbPool();

// Get all public settings
export const getSettings = async (req, res) => {
  try {
    // Check available columns
    const hasTypeColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'type'"
    );
    const hasPublicColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'is_public'"
    );
    
    // Build query based on available columns
    let query = "SELECT key, value";
    if (hasTypeColumn.rows.length > 0) {
      query += ", type";
    }
    query += " FROM settings";
    if (hasPublicColumn.rows.length > 0) {
      query += " WHERE is_public = true";
    }
    query += " ORDER BY key";
    
    const result = await pool.query(query);
    
    // Convert settings array to object for easier frontend use
    const settings = {};
    result.rows.forEach(row => {
      let value = row.value;
      
      // Parse value based on type if type column exists
      if (row.type) {
        if (row.type === 'boolean') {
          value = value === 'true';
        } else if (row.type === 'number') {
          value = parseFloat(value);
        } else if (row.type === 'json') {
          try {
            // Handle case where PostgreSQL jsonb returns already parsed object
            value = typeof value === 'string' ? JSON.parse(value) : value;
          } catch (e) {
            console.error(`Error parsing JSON setting ${row.key}:`, e);
          }
        }
      }
      
      settings[row.key] = value;
    });
    
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ message: "Error fetching settings" });
  }
};

// Get all settings including admin-only ones (admin only)
export const getAllSettings = async (req, res) => {
  try {
    // Check available columns
    const hasTypeColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'type'"
    );
    const hasGroupColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'group_name'"
    );
    const hasDescriptionColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'description'"
    );
    const hasPublicColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'is_public'"
    );
    
    // Build query based on available columns
    let query = "SELECT key, value";
    if (hasTypeColumn.rows.length > 0) {
      query += ", type";
    }
    if (hasGroupColumn.rows.length > 0) {
      query += ", group_name";
    }
    if (hasDescriptionColumn.rows.length > 0) {
      query += ", description";
    }
    if (hasPublicColumn.rows.length > 0) {
      query += ", is_public";
    }
    query += " FROM settings ORDER BY";
    if (hasGroupColumn.rows.length > 0) {
      query += " group_name,";
    }
    query += " key";
    
    const result = await pool.query(query);
    
    // Convert settings array to object for easier frontend use
    const settings = {};
    result.rows.forEach(row => {
      let value = row.value;
      
      // Parse value based on type if type column exists
      if (row.type) {
        if (row.type === 'boolean') {
          value = value === 'true';
        } else if (row.type === 'number') {
          value = parseFloat(value);
        } else if (row.type === 'json') {
          try {
            // Handle case where PostgreSQL jsonb returns already parsed object
            value = typeof value === 'string' ? JSON.parse(value) : value;
          } catch (e) {
            console.error(`Error parsing JSON setting ${row.key}:`, e);
          }
        }
      }
      
      // Use camelCase for frontend
      const camelKey = row.key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      settings[camelKey] = value;
    });
    
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching all settings:", error);
    res.status(500).json({ message: "Error fetching settings" });
  }
};

// Update settings (admin only - basic version)
export const updateSettings = async (req, res) => {
  try {
    const updates = req.body;
    
    // Check available columns
    const hasTypeColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'type'"
    );
    const hasPublicColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'is_public'"
    );
    const hasUpdatedAtColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'updated_at'"
    );
    
    for (const [key, value] of Object.entries(updates)) {
      let stringValue;
      let type = 'string';
      
      // Determine type and ensure proper JSON encoding for jsonb column
      if (typeof value === 'boolean') {
        type = 'boolean';
        stringValue = JSON.stringify(value.toString());
      } else if (typeof value === 'number') {
        type = 'number';
        stringValue = JSON.stringify(value.toString());
      } else if (typeof value === 'object') {
        type = 'json';
        stringValue = JSON.stringify(value);
      } else {
        // String values also need to be JSON encoded for jsonb column
        stringValue = JSON.stringify(value);
      }
      
      // Build query dynamically
      let insertQuery = 'INSERT INTO settings (key, value';
      let insertValues = '($1, $2';
      let updateQuery = 'DO UPDATE SET value = $2';
      let params = [key, stringValue];
      let paramIndex = 2;
      
      if (hasTypeColumn.rows.length > 0) {
        insertQuery += ', type';
        insertValues += ', $' + (++paramIndex);
        updateQuery += ', type = $' + paramIndex;
        params.push(type);
      }
      
      if (hasPublicColumn.rows.length > 0) {
        insertQuery += ', is_public';
        insertValues += ', $' + (++paramIndex);
        updateQuery += ', is_public = $' + paramIndex;
        params.push(true);
      }
      
      if (hasUpdatedAtColumn.rows.length > 0) {
        insertQuery += ', updated_at';
        insertValues += ', CURRENT_TIMESTAMP';
        updateQuery += ', updated_at = CURRENT_TIMESTAMP';
      }
      
      insertQuery += ') VALUES ' + insertValues + ') ON CONFLICT (key) ' + updateQuery;
      
      await pool.query(insertQuery, params);
    }
    
    res.status(200).json({ message: "Settings updated successfully" });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ message: "Error updating settings" });
  }
};

// Get social media links
export const getSocialMediaLinks = async (req, res) => {
  try {
    const socialKeys = [
      'social_linkedin_url',
      'social_twitter_url', 
      'social_instagram_url',
      'social_threads_url'
    ];
    
    const result = await pool.query(
      "SELECT key, value FROM settings WHERE key = ANY($1)",
      [socialKeys]
    );
    
    const socialLinks = {
      linkedin: '',
      twitter: '',
      instagram: '',
      threads: ''
    };
    
    result.rows.forEach(row => {
      switch (row.key) {
        case 'social_linkedin_url':
          socialLinks.linkedin = row.value || '';
          break;
        case 'social_twitter_url':
          socialLinks.twitter = row.value || '';
          break;
        case 'social_instagram_url':
          socialLinks.instagram = row.value || '';
          break;
        case 'social_threads_url':
          socialLinks.threads = row.value || '';
          break;
      }
    });
    
    res.status(200).json(socialLinks);
  } catch (error) {
    console.error("Error fetching social media links:", error);
    res.status(500).json({ message: "Error fetching social media links" });
  }
};

// Update social media links
export const updateSocialMediaLinks = async (req, res) => {
  try {
    const { linkedin, twitter, instagram, threads } = req.body;
    
    const updates = [
      { key: 'social_linkedin_url', value: linkedin || '' },
      { key: 'social_twitter_url', value: twitter || '' },
      { key: 'social_instagram_url', value: instagram || '' },
      { key: 'social_threads_url', value: threads || '' }
    ];
    
    // Check if the settings table has the type column
    const hasTypeColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'type'"
    );
    
    const hasGroupColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'group_name'"
    );
    
    const hasDescriptionColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'description'"
    );
    
    const hasPublicColumn = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'is_public'"
    );
    
    for (const update of updates) {
      // Build query dynamically based on available columns
      let insertQuery = 'INSERT INTO settings (key, value';
      let insertValues = '($1, $2';
      let updateQuery = 'DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP';
      // Since value column is JSONB, we need to JSON stringify the string
      let params = [update.key, JSON.stringify(update.value)];
      let paramIndex = 2;
      
      if (hasTypeColumn.rows.length > 0) {
        insertQuery += ', type';
        insertValues += ', $' + (++paramIndex);
        params.push('string');
      }
      
      if (hasGroupColumn.rows.length > 0) {
        insertQuery += ', group_name';
        insertValues += ', $' + (++paramIndex);
        params.push('social');
      }
      
      if (hasDescriptionColumn.rows.length > 0) {
        insertQuery += ', description';
        insertValues += ', $' + (++paramIndex);
        params.push(`URL for ${update.key.replace('social_', '').replace('_url', '')} social media profile`);
      }
      
      if (hasPublicColumn.rows.length > 0) {
        insertQuery += ', is_public';
        insertValues += ', $' + (++paramIndex);
        params.push(true);
      }
      
      // Add updated_at if column exists
      const hasUpdatedAtColumn = await pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'updated_at'"
      );
      
      if (hasUpdatedAtColumn.rows.length > 0) {
        insertQuery += ', updated_at';
        insertValues += ', CURRENT_TIMESTAMP';
      }
      
      insertQuery += ') VALUES ' + insertValues + ') ON CONFLICT (key) ' + updateQuery;
      
      await pool.query(insertQuery, params);
    }
    
    res.status(200).json({ 
      message: "Social media links updated successfully",
      links: { linkedin, twitter, instagram, threads }
    });
  } catch (error) {
    console.error("Error updating social media links:", error);
    res.status(500).json({ message: "Error updating social media links" });
  }
};

// Get OAuth configuration (admin only)
export const getOAuthSettings = async (req, res) => {
  try {
    // Read OAuth settings from CoreDB
    const { default: CoreDB } = await import('../services/CoreDB.js');
    const coreDB = CoreDB.getInstance();
    
    const oauthKeys = [
      'oauth_frontend_url',
      'oauth_cognito_user_pool_id',
      'oauth_cognito_client_id',
      'oauth_cognito_client_secret',
      'oauth_cognito_region',
      'oauth_cognito_domain'
    ];
    
    const result = { rows: [] };
    for (const key of oauthKeys) {
      const value = await coreDB.getConfig(key);
      if (value !== null) {
        result.rows.push({ key, value: typeof value === 'string' ? value : JSON.stringify(value) });
      }
    }
    
    const oauthConfig = {
      google: {
        enabled: false,
        clientId: '',
        clientSecret: '',
        redirectUri: ''
      },
      facebook: {
        enabled: false,
        appId: '',
        appSecret: '',
        redirectUri: ''
      },
      twitter: {
        enabled: false,
        consumerKey: '',
        consumerSecret: '',
        callbackUrl: ''
      },
      cognito: {
        enabled: false,
        userPoolId: '',
        clientId: '',
        clientSecret: '',
        region: '',
        domain: ''
      }
    };
    
    // Map database values to structure
    result.rows.forEach(row => {
      switch (row.key) {
        case 'oauth_google_client_id':
          oauthConfig.google.clientId = row.value || '';
          oauthConfig.google.enabled = !!(row.value && row.value.trim());
          break;
        case 'oauth_google_client_secret':
          oauthConfig.google.clientSecret = row.value || '';
          break;
        case 'oauth_facebook_app_id':
          oauthConfig.facebook.appId = row.value || '';
          oauthConfig.facebook.enabled = !!(row.value && row.value.trim());
          break;
        case 'oauth_facebook_app_secret':
          oauthConfig.facebook.appSecret = row.value || '';
          break;
        case 'oauth_twitter_consumer_key':
          oauthConfig.twitter.consumerKey = row.value || '';
          oauthConfig.twitter.enabled = !!(row.value && row.value.trim());
          break;
        case 'oauth_twitter_consumer_secret':
          oauthConfig.twitter.consumerSecret = row.value || '';
          break;
        case 'oauth_cognito_user_pool_id':
          oauthConfig.cognito.userPoolId = row.value || '';
          oauthConfig.cognito.enabled = !!(row.value && row.value.trim());
          break;
        case 'oauth_cognito_client_id':
          oauthConfig.cognito.clientId = row.value || '';
          break;
        case 'oauth_cognito_client_secret':
          oauthConfig.cognito.clientSecret = row.value || '';
          break;
        case 'oauth_cognito_region':
          oauthConfig.cognito.region = row.value || '';
          break;
        case 'oauth_cognito_domain':
          oauthConfig.cognito.domain = row.value || '';
          break;
        case 'oauth_frontend_url':
          // Set redirect URIs based on frontend URL
          const baseUrl = row.value || 'https://blog.ingasti.com';
          oauthConfig.google.redirectUri = `${baseUrl}/auth/google/callback`;
          oauthConfig.facebook.redirectUri = `${baseUrl}/auth/facebook/callback`;
          oauthConfig.twitter.callbackUrl = `${baseUrl}/auth/twitter/callback`;
          break;
      }
    });
    
    res.status(200).json({
      success: true,
      config: oauthConfig
    });
  } catch (error) {
    console.error("Error fetching OAuth settings:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching OAuth configuration" 
    });
  }
};

// Update OAuth configuration (admin only)
export const updateOAuthSettings = async (req, res) => {
  try {
    const { google, facebook, twitter, cognito } = req.body;
    
    if (!google && !facebook && !twitter && !cognito) {
      return res.status(400).json({
        success: false,
        message: 'No OAuth configuration provided'
      });
    }
    
    const updates = [];
    
    // Process Google config
    if (google) {
      updates.push(
        { key: 'oauth_google_client_id', value: google.clientId || '' },
        { key: 'oauth_google_client_secret', value: google.clientSecret || '' }
      );
    }
    
    // Process Facebook config
    if (facebook) {
      updates.push(
        { key: 'oauth_facebook_app_id', value: facebook.appId || '' },
        { key: 'oauth_facebook_app_secret', value: facebook.appSecret || '' }
      );
    }
    
    // Process Twitter config
    if (twitter) {
      updates.push(
        { key: 'oauth_twitter_consumer_key', value: twitter.consumerKey || '' },
        { key: 'oauth_twitter_consumer_secret', value: twitter.consumerSecret || '' }
      );
    }
    
    // Process Cognito config
    if (cognito) {
      updates.push(
        { key: 'oauth_cognito_user_pool_id', value: cognito.userPoolId || '' },
        { key: 'oauth_cognito_client_id', value: cognito.clientId || '' },
        { key: 'oauth_cognito_client_secret', value: cognito.clientSecret || '' },
        { key: 'oauth_cognito_region', value: cognito.region || '' },
        { key: 'oauth_cognito_domain', value: cognito.domain || '' }
      );
    }
    
    // Update CoreDB with OAuth settings
    const { default: CoreDB } = await import('../services/CoreDB.js');
    const coreDB = CoreDB.getInstance();
    
    // Update database
    for (const update of updates) {
      await coreDB.setConfig(update.key, JSON.stringify(update.value), 'oauth', false);
    }
    
    res.status(200).json({
      success: true,
      message: "OAuth configuration updated successfully"
    });
  } catch (error) {
    console.error("Error updating OAuth settings:", error);
    res.status(500).json({ 
      success: false,
      message: "Error updating OAuth configuration" 
    });
  }
};

// Get AWS External ID (admin only)
export const getAwsExternalId = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT value, updated_at FROM settings WHERE key = 'aws_external_id'"
    );
    
    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        externalId: null,
        generatedAt: null
      });
    }
    
    const setting = result.rows[0];
    let configData;
    try {
      configData = JSON.parse(setting.value);
    } catch (e) {
      configData = { externalId: setting.value };
    }
    
    res.status(200).json({
      success: true,
      externalId: configData.externalId,
      generatedAt: configData.generatedAt || setting.updated_at,
      generatedBy: configData.generatedBy || 'admin'
    });
  } catch (error) {
    console.error("Error fetching AWS External ID:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching AWS External ID" 
    });
  }
};

// Save AWS External ID (admin only)
export const saveAwsExternalId = async (req, res) => {
  try {
    const { externalId, generatedAt, generatedBy } = req.body;
    
    if (!externalId) {
      return res.status(400).json({
        success: false,
        message: 'External ID is required'
      });
    }
    
    // Validate External ID format (AWS requirements)
    const externalIdRegex = /^[a-zA-Z0-9+\-=,.@:\/]+$/;
    if (!externalIdRegex.test(externalId) || externalId.length < 2 || externalId.length > 1224) {
      return res.status(400).json({
        success: false,
        message: 'Invalid External ID format. Must be 2-1224 characters, alphanumeric with allowed special characters: +-=,.@:/-'
      });
    }
    
    const configData = {
      externalId,
      generatedAt: generatedAt || new Date().toISOString(),
      generatedBy: generatedBy || 'admin',
      adminUserId: req.adminUser.id
    };
    
    // Check if setting exists
    const existing = await pool.query(
      "SELECT id FROM settings WHERE key = 'aws_external_id'"
    );
    
    if (existing.rows.length > 0) {
      // Update existing
      await pool.query(
        `UPDATE settings SET 
           value = $1, 
           updated_at = CURRENT_TIMESTAMP
         WHERE key = 'aws_external_id'`,
        [JSON.stringify(configData)]
      );
    } else {
      // Insert new
      await pool.query(
        `INSERT INTO settings (key, value, type, group_name, description, is_public, created_at, updated_at)
         VALUES ($1, $2, 'json', 'aws', 'AWS External ID for S3 integration security', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        ['aws_external_id', JSON.stringify(configData)]
      );
    }
    
    res.status(200).json({
      success: true,
      message: "AWS External ID saved successfully",
      externalId: configData.externalId,
      generatedAt: configData.generatedAt
    });
  } catch (error) {
    console.error("Error saving AWS External ID:", error);
    res.status(500).json({ 
      success: false,
      message: "Error saving AWS External ID" 
    });
  }
};

// Get AWS Configuration (admin only)
export const getAwsConfig = async (req, res) => {
  try {
    const pool = getDbPool();
    const result = await pool.query(
      "SELECT value FROM settings WHERE key = 'aws_config'"
    );
    
    let awsConfig = {};
    if (result.rows.length > 0) {
      try {
        awsConfig = JSON.parse(result.rows[0].value);
      } catch (e) {
        console.error('Error parsing aws_config JSON:', e);
        awsConfig = {};
      }
    }
    
    res.status(200).json({
      success: true,
      awsConfig
    });
  } catch (error) {
    console.error("Error fetching AWS configuration:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching AWS configuration" 
    });
  }
};

// Update AWS Configuration (admin only)
export const updateAwsConfig = async (req, res) => {
  try {
    console.log('🔧 updateAwsConfig called with:', req.body);
    
    const { 
      bucketName, 
      region, 
      roleArn, 
      externalId, 
      accessKey, 
      secretKey, 
      sessionToken,
      authMethod,
      ssoStartUrl,
      ssoRegion,
      ssoAccountId,
      ssoRoleName,
      // Temporary Identity Center credentials
      tempAccessKey,
      tempSecretKey,
      tempSessionToken,
      // OIDC federation credentials
      accountId,
      oidcIssuerUrl,
      oidcAudience,
      oidcSubject
    } = req.body;
    
    // Trim all string inputs to prevent whitespace issues
    const trimmedBucketName = bucketName?.trim();
    const trimmedRegion = region?.trim();
    const trimmedRoleArn = roleArn?.trim();
    const trimmedExternalId = externalId?.trim();
    const trimmedAccessKey = accessKey?.trim();
    const trimmedSecretKey = secretKey?.trim();
    const trimmedSessionToken = sessionToken?.trim();
    const trimmedAuthMethod = authMethod?.trim();
    const trimmedSsoStartUrl = ssoStartUrl?.trim();
    const trimmedSsoRegion = ssoRegion?.trim();
    const trimmedSsoAccountId = ssoAccountId?.trim();
    const trimmedSsoRoleName = ssoRoleName?.trim();
    // Temporary credentials
    const trimmedTempAccessKey = tempAccessKey?.trim();
    const trimmedTempSecretKey = tempSecretKey?.trim();
    const trimmedTempSessionToken = tempSessionToken?.trim();
    // OIDC credentials
    const trimmedAccountId = accountId?.trim();
    const trimmedOidcIssuerUrl = oidcIssuerUrl?.trim();
    const trimmedOidcAudience = oidcAudience?.trim();
    const trimmedOidcSubject = oidcSubject?.trim();
    
    console.log('🔧 Trimmed values:', { 
      trimmedBucketName, 
      trimmedRegion, 
      trimmedRoleArn, 
      trimmedExternalId: trimmedExternalId ? 'SET' : 'MISSING',
      trimmedAccessKey: trimmedAccessKey ? 'SET' : 'MISSING',
      trimmedSecretKey: trimmedSecretKey ? 'SET' : 'MISSING',
      trimmedSessionToken: trimmedSessionToken ? 'SET' : 'MISSING',
      trimmedAuthMethod,
      trimmedSsoStartUrl: trimmedSsoStartUrl ? 'SET' : 'MISSING',
      trimmedSsoRegion,
      trimmedSsoAccountId,
      trimmedSsoRoleName: trimmedSsoRoleName ? 'SET' : 'MISSING',
      trimmedTempAccessKey: trimmedTempAccessKey ? 'SET' : 'MISSING',
      trimmedTempSecretKey: trimmedTempSecretKey ? 'SET' : 'MISSING',
      trimmedTempSessionToken: trimmedTempSessionToken ? 'SET' : 'MISSING'
    });
    
    // Validate required fields based on authentication method
    const hasRoleAuth = trimmedRoleArn && trimmedExternalId;
    const hasKeyAuth = trimmedAccessKey && trimmedSecretKey;
    const hasSsoConfig = trimmedSsoStartUrl && trimmedSsoRegion && trimmedSsoAccountId && trimmedSsoRoleName;
    const hasTempCredentials = trimmedTempAccessKey && trimmedTempSecretKey && trimmedTempSessionToken;
    const hasOidcConfig = trimmedAccountId && trimmedOidcIssuerUrl && trimmedRoleArn && trimmedOidcSubject;
    
    if (!trimmedBucketName || !trimmedRegion) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bucket name and region are required' 
      });
    }
    
    // Validate authentication method
    if (trimmedAuthMethod === 'sso') {
      // For SSO authentication, we need either SSO configuration or temporary credentials
      if (!hasSsoConfig && !hasTempCredentials) {
        return res.status(400).json({ 
          success: false, 
          message: 'SSO configuration incomplete. Either provide SSO settings (Start URL, Region, Account ID, Role Name) or temporary Identity Center credentials' 
        });
      }
      console.log('✅ Using AWS SSO authentication:', hasTempCredentials ? 'with temporary credentials' : 'with SSO configuration');
    } else if (trimmedAuthMethod === 'oidc') {
      // For OIDC authentication, we need OIDC configuration
      if (!hasOidcConfig) {
        return res.status(400).json({ 
          success: false, 
          message: 'OIDC configuration incomplete. Required fields: AWS Account ID, OIDC Issuer URL, OIDC Subject, and Role ARN' 
        });
      }
      console.log('✅ Using OIDC federation authentication');
    } else {
      // For other authentication methods, require role and access keys
      if (!hasRoleAuth) {
        return res.status(400).json({ 
          success: false, 
          message: 'Role ARN and External ID are required for role assumption' 
        });
      }
      
      if (!hasKeyAuth) {
        return res.status(400).json({ 
          success: false, 
          message: 'Access keys are required for initial authentication to assume roles. Get temporary credentials from AWS Identity Center.' 
        });
      }
    }
    
    // Create consolidated AWS config object
    const awsConfig = {
      bucketName: trimmedBucketName,
      region: trimmedRegion,
      authMethod: trimmedAuthMethod || 'hybrid',
      updatedAt: new Date().toISOString(),
      updatedBy: req.adminUser.id
    };
    
    // Add SSO configuration if using SSO auth
    if (trimmedAuthMethod === 'sso') {
      if (hasSsoConfig) {
        awsConfig.ssoStartUrl = trimmedSsoStartUrl;
        awsConfig.ssoRegion = trimmedSsoRegion;
        awsConfig.ssoAccountId = trimmedSsoAccountId;
        awsConfig.ssoRoleName = trimmedSsoRoleName;
        console.log('✅ SSO configuration added to AWS config');
      }
      
      if (hasTempCredentials) {
        awsConfig.tempAccessKey = trimmedTempAccessKey;
        awsConfig.tempSecretKey = trimmedTempSecretKey;
        awsConfig.tempSessionToken = trimmedTempSessionToken;
        console.log('✅ Temporary Identity Center credentials added to AWS config');
      }
    }
    
    // Add OIDC configuration if using OIDC auth
    if (trimmedAuthMethod === 'oidc') {
      awsConfig.accountId = trimmedAccountId;
      awsConfig.oidcIssuerUrl = trimmedOidcIssuerUrl;
      awsConfig.oidcAudience = trimmedOidcAudience;
      awsConfig.oidcSubject = trimmedOidcSubject;
      awsConfig.roleArn = trimmedRoleArn;
      console.log('✅ OIDC federation configuration added to AWS config');
    }
    
    // Add role-based auth if provided
    if (hasRoleAuth) {
      awsConfig.roleArn = trimmedRoleArn;
      awsConfig.externalId = trimmedExternalId;
      if (!trimmedAuthMethod || trimmedAuthMethod === 'hybrid') {
        awsConfig.authMethod = 'role';
      }
    }
    
    // Add key-based auth if provided  
    if (hasKeyAuth) {
      awsConfig.accessKey = trimmedAccessKey;
      awsConfig.secretKey = trimmedSecretKey;
      if (!trimmedAuthMethod) {
        awsConfig.authMethod = hasRoleAuth ? 'hybrid' : 'keys';
      }
      
      // Add session token if provided (for temporary credentials)
      if (trimmedSessionToken) {
        awsConfig.sessionToken = trimmedSessionToken;
      }
    }
    
    const pool = getDbPool();
    
    // Save the consolidated aws_config object
    await pool.query(
      'INSERT INTO settings (key, value, type) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, type = EXCLUDED.type',
      ['aws_config', JSON.stringify(awsConfig), 'json']
    );

    // Set media storage type to AWS
    await pool.query(
      'INSERT INTO settings (key, value, type) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, type = EXCLUDED.type',
      ['media_storage_type', 'aws', 'string']
    );

    console.log('🔧 Media storage type set to AWS');

    // Also save External ID separately for the External ID management
    const externalIdData = {
      externalId: trimmedExternalId,
      generatedAt: new Date().toISOString(),
      generatedBy: 'admin',
      adminUserId: req.adminUser.id
    };

    await pool.query(
      'INSERT INTO settings (key, value, type) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, type = EXCLUDED.type',
      ['aws_external_id', JSON.stringify(externalIdData), 'json']
    );

    console.log('🔧 AWS configuration saved successfully:', awsConfig);
    
    // Reinitialize credential manager with new configuration
    try {
      await credentialManager.updateConfiguration(awsConfig);
      console.log('✅ Credential manager reinitialized with new configuration');
    } catch (credError) {
      console.error('⚠️ Warning: Failed to reinitialize credential manager:', credError.message);
      // Don't fail the request, just log the warning
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'AWS configuration saved successfully',
      config: awsConfig
    });
  } catch (error) {
    console.error('Error updating AWS configuration:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error saving AWS configuration' 
    });
  }
};

// Get Media Storage Configuration
export const getMediaStorageConfig = async (req, res) => {
  try {
    // Import CoreDB manager
    const { CoreDBConfigManager } = await import('../utils/coredb.js');
    const coreDB = new CoreDBConfigManager();
    
    // Get storage type and configurations from CoreDB system_config table
    const storageType = await coreDB.getConfig('media.storage_type') || 
                       await coreDB.getConfig('media_storage_type') || 'internal';
    
    const awsConfig = await coreDB.getConfig('aws.config') || 
                     await coreDB.getConfig('aws_config') || {};
    
    const ociConfig = await coreDB.getConfig('oci_config') || {};
    
    const config = {
      storageType: storageType,
      awsConfig: typeof awsConfig === 'string' ? JSON.parse(awsConfig) : awsConfig,
      ociConfig: typeof ociConfig === 'string' ? JSON.parse(ociConfig) : ociConfig
    };
    
    console.log('🔧 Media Storage Config Retrieved:', {
      storageType: config.storageType,
      hasAwsConfig: !!config.awsConfig && Object.keys(config.awsConfig).length > 0,
      hasOciConfig: !!config.ociConfig && Object.keys(config.ociConfig).length > 0
    });
    
    res.status(200).json({
      success: true,
      config
    });
  } catch (error) {
    console.error("Error fetching media storage configuration:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching media storage configuration" 
    });
  }
};


