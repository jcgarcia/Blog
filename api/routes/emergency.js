/**
 * Emergency API endpoints for fixing critical CoreDB issues
 * These endpoints should only be used during outages and emergencies
 */

import { Router } from 'express';
import CoreDB from '../services/CoreDB.js';

const router = Router();

/**
 * Emergency endpoint to clear corrupted database connections
 * Use this when encryption key mismatch prevents connection retrieval
 */
router.post('/clear-corrupted-connections', async (req, res) => {
  try {
    console.log('🚨 EMERGENCY: Clearing corrupted database connections');
    
    // Wait for CoreDB to be ready
    if (!CoreDB.initialized) {
      throw new Error('CoreDB not initialized');
    }
    
    // Direct SQL to clear all database connections
    const clearConnectionsQuery = `DELETE FROM database_connections`;
    await CoreDB.db.run(clearConnectionsQuery);
    
    // Also clear any related metadata
    const clearActiveQuery = `UPDATE system_config SET value = NULL WHERE key = 'active_database_connection'`;
    await CoreDB.db.run(clearActiveQuery);
    
    console.log('✅ EMERGENCY: Corrupted connections cleared successfully');
    
    res.json({
      success: true,
      message: 'Corrupted database connections cleared. You can now create fresh connections.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ EMERGENCY: Failed to clear corrupted connections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear corrupted connections',
      details: error.message
    });
  }
});

/**
 * Emergency endpoint to verify CoreDB health
 */
router.get('/coredb-status', async (req, res) => {
  try {
    // Check if CoreDB is initialized
    if (!CoreDB.initialized) {
      throw new Error('CoreDB not initialized');
    }
    
    // Test basic CoreDB operations
    const connectionsQuery = `SELECT COUNT(*) as count FROM database_connections`;
    const result = await CoreDB.db.get(connectionsQuery);
    
    // Test encryption key
    let encryptionStatus = 'working';
    try {
      const testEncryption = CoreDB.encrypt('test-data');
      const testDecryption = CoreDB.decrypt(testEncryption);
      if (testDecryption !== 'test-data') {
        encryptionStatus = 'failed';
      }
    } catch (error) {
      encryptionStatus = 'error: ' + error.message;
    }
    
    res.json({
      success: true,
      coredb: {
        database_accessible: true,
        connection_count: result.count,
        encryption_status: encryptionStatus,
        encryption_key_set: !!process.env.COREDB_ENCRYPTION_KEY
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'CoreDB health check failed',
      details: error.message
    });
  }
});

export default router;