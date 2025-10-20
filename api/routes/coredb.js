import express from 'express';
import CoreDB from '../services/CoreDB.js';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();

// Get CoreDB status
router.get('/status', async (req, res) => {
  try {
    const status = {
      initialized: CoreDB.isInitialized(),
      config_path: CoreDB.getConfigPath(),
      version: '1.0.0',
      external_database: null
    };

    // Check if external database is configured
    try {
      const externalDbConfig = await CoreDB.getConfig('external_database');
      if (externalDbConfig) {
        status.external_database = {
          host: externalDbConfig.host,
          port: externalDbConfig.port,
          database: externalDbConfig.database,
          username: externalDbConfig.username,
          ssl: externalDbConfig.ssl
          // Don't include password in status response
        };
      }
    } catch (error) {
      console.warn('Could not retrieve external database config:', error.message);
    }

    res.json(status);
  } catch (error) {
    console.error('Error getting CoreDB status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get CoreDB status',
      error: error.message 
    });
  }
});

// Save CoreDB configuration
router.post('/config', async (req, res) => {
  try {
    const { external_database } = req.body;

    if (!external_database) {
      return res.status(400).json({
        success: false,
        message: 'External database configuration is required'
      });
    }

    // Validate required fields
    const requiredFields = ['host', 'port', 'database', 'username', 'password'];
    for (const field of requiredFields) {
      if (!external_database[field]) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`
        });
      }
    }

    // Save external database configuration
    await CoreDB.setConfig('external_database', external_database);

    console.log('✅ External database configuration saved to CoreDB');

    res.json({
      success: true,
      message: 'Configuration saved successfully'
    });
  } catch (error) {
    console.error('Error saving CoreDB configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save configuration',
      error: error.message
    });
  }
});

// Test database connection
router.post('/test-connection', async (req, res) => {
  try {
    const { host, port, database, username, password, ssl } = req.body;

    if (!host || !port || !database || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'All database connection fields are required'
      });
    }

    // Create a test connection
    const testPool = new Pool({
      host,
      port,
      database,
      user: username,
      password,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      max: 1, // Only need one connection for testing
      connectionTimeoutMillis: 5000, // 5 second timeout
      idleTimeoutMillis: 1000 // 1 second idle timeout
    });

    try {
      // Test the connection
      const client = await testPool.connect();
      
      // Run a simple query to verify connection
      const result = await client.query('SELECT version() as version, current_database() as database');
      
      client.release();
      
      await testPool.end(); // Close the test pool
      
      res.json({
        success: true,
        message: 'Database connection successful',
        database_info: {
          version: result.rows[0].version,
          database: result.rows[0].database
        }
      });
    } catch (dbError) {
      await testPool.end(); // Make sure to close the pool
      throw dbError;
    }
  } catch (error) {
    console.error('Database connection test failed:', error);
    
    let errorMessage = 'Database connection failed';
    if (error.code === 'ENOTFOUND') {
      errorMessage = 'Database host not found. Please check the hostname.';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused. Please check the host and port.';
    } else if (error.code === '28P01') {
      errorMessage = 'Authentication failed. Please check username and password.';
    } else if (error.code === '3D000') {
      errorMessage = 'Database does not exist. Please check the database name.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(400).json({
      success: false,
      message: errorMessage,
      error_code: error.code
    });
  }
});

// Get all CoreDB configurations (for debugging)
router.get('/configs', async (req, res) => {
  try {
    const configs = await CoreDB.getAllConfigs();
    
    // Remove sensitive data like passwords
    const sanitizedConfigs = {};
    for (const [key, value] of Object.entries(configs)) {
      if (typeof value === 'object' && value !== null) {
        sanitizedConfigs[key] = { ...value };
        if ('password' in sanitizedConfigs[key]) {
          sanitizedConfigs[key].password = '[HIDDEN]';
        }
      } else {
        sanitizedConfigs[key] = value;
      }
    }

    res.json({
      success: true,
      configs: sanitizedConfigs
    });
  } catch (error) {
    console.error('Error getting CoreDB configs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get configurations',
      error: error.message
    });
  }
});

export default router;