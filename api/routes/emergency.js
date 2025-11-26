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
    
    // Use the singleton instance
    const coreDB = CoreDB.getInstance();
    
    // Clear all database connections using CoreDB method
    await coreDB.clearAllDatabaseConnections();
    
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
    // Use the singleton instance
    const coreDB = CoreDB.getInstance();
    
    // Test basic CoreDB operations
    const result = await coreDB.getConnectionsStatus();
    
    // Test encryption key
    let encryptionStatus = 'working';
    try {
      const testEncryption = coreDB.encrypt('test-data');
      const testDecryption = coreDB.decrypt(testEncryption);
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