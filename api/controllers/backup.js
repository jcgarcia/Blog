import express from 'express';
import { requireAdminAuth } from './admin.js';
import backupStorageService from '../services/backupStorageService.js';
import backupSchedulerService from '../services/backupSchedulerService.js';
import databaseManager from '../services/DatabaseManager.js';

const router = express.Router();

/**
 * Backup Management Controller
 * Provides API endpoints for backup scheduling, management, and monitoring
 * All endpoints require admin permissions
 */

/**
 * Get backup system status and statistics
 * GET /api/backup/status
 */
router.get('/status', requireAdminAuth, async (req, res) => {
  try {
    console.log('📊 Getting backup system status...');
    
    // Get backup statistics
    const backupStats = await backupStorageService.getBackupStats();
    
    // Get scheduler status
    const schedules = backupSchedulerService.getSchedules();
    const activeSchedules = schedules.filter(s => s.status === 'running').length;
    
    const status = {
      storage: {
        totalBackups: backupStats.totalBackups,
        totalSize: backupStats.totalSize,
        totalSizeMB: Math.round(backupStats.totalSize / 1024 / 1024 * 100) / 100,
        latestBackup: backupStats.latestBackup,
        withinRetentionPolicy: backupStats.withinRetentionPolicy,
        retentionPolicy: backupStats.retentionPolicy
      },
      scheduler: {
        totalSchedules: schedules.length,
        activeSchedules,
        inactiveSchedules: schedules.length - activeSchedules,
        schedules: schedules.map(s => ({
          id: s.id,
          status: s.status,
          nextRun: s.nextRun,
          lastRun: s.lastRun,
          cronExpression: s.config.cronExpression
        }))
      },
      system: {
        initialized: backupSchedulerService.isInitialized,
        timestamp: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('❌ Failed to get backup status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup system status',
      details: error.message
    });
  }
});

/**
 * List all stored backups
 * GET /api/backup/list
 */
router.get('/list', requireAdminAuth, async (req, res) => {
  try {
    console.log('📋 Listing stored backups...');
    
    const backups = await backupStorageService.listBackups();
    
    res.json({
      success: true,
      data: {
        backups,
        count: backups.length
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to list backups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list backups',
      details: error.message
    });
  }
});

/**
 * Create a manual backup
 * POST /api/backup/create
 * Query params:
 *   - type: 'datadb' | 'coredb' | 'comprehensive' (default: 'datadb' for backward compatibility)
 */
router.post('/create', requireAdminAuth, async (req, res) => {
  try {
    const { type = 'datadb' } = req.query;
    
    let backupInfo;
    
    if (type === 'comprehensive') {
      console.log('🔄 Creating comprehensive manual backup (DataDB + CoreDB)...');
      backupInfo = await backupStorageService.createComprehensiveBackup('manual');
      
      res.json({
        success: true,
        message: `Comprehensive backup completed: ${backupInfo.successfulBackups}/${backupInfo.totalBackups} databases backed up successfully`,
        data: backupInfo
      });
      
    } else if (type === 'coredb') {
      console.log('🔄 Creating CoreDB manual backup...');
      const coreDBConnection = await databaseManager.getCoreDBConnection();
      backupInfo = await backupStorageService.createSingleDatabaseBackup(coreDBConnection, 'manual', new Date().toISOString().replace(/[:.]/g, '-'), 'coredb');
      
      res.json({
        success: true,
        message: 'CoreDB backup created successfully',
        data: backupInfo
      });
      
    } else {
      // Default: DataDB backup (backward compatibility)
      console.log('🔄 Creating DataDB manual backup...');
      backupInfo = await backupStorageService.createAndUploadBackup('manual');
      
      res.json({
        success: true,
        message: 'DataDB backup created successfully',
        data: backupInfo
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to create backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup',
      details: error.message
    });
  }
});

/**
 * Create a comprehensive backup (DataDB + CoreDB)
 * POST /api/backup/create-comprehensive
 */
router.post('/create-comprehensive', requireAdminAuth, async (req, res) => {
  try {
    console.log('🔄 Creating comprehensive manual backup (DataDB + CoreDB)...');
    
    const backupInfo = await backupStorageService.createComprehensiveBackup('manual');
    
    res.json({
      success: true,
      message: `Comprehensive backup completed: ${backupInfo.successfulBackups}/${backupInfo.totalBackups} databases backed up successfully`,
      data: backupInfo
    });
    
  } catch (error) {
    console.error('❌ Failed to create comprehensive backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create comprehensive backup',
      details: error.message
    });
  }
});

/**
 * Download a specific backup
 * GET /api/backup/download/:filename
 */
// Download backup endpoint
router.get('/download/:filename', requireAdminAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const { expires = 3600 } = req.query; // Default 1 hour expiration
    
    console.log(`🔗 Generating download URL for backup: ${filename}`);
    
    // Construct S3 key
    const s3Key = `database-backups/${filename}`;
    
    // Generate signed URL
    const downloadUrl = await backupStorageService.generateDownloadUrl(s3Key, parseInt(expires));
    
    res.json({
      success: true,
      data: {
        filename,
        downloadUrl,
        expiresIn: parseInt(expires),
        expiresAt: new Date(Date.now() + parseInt(expires) * 1000).toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to generate download URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate download URL',
      details: error.message
    });
  }
});

/**
 * Delete a specific backup
 * DELETE /api/backup/:filename
 */
// Delete backup endpoint
router.delete('/:filename', requireAdminAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    
    console.log(`🗑️ Deleting backup: ${filename}`);
    
    // Construct S3 key
    const s3Key = `database-backups/${filename}`;
    
    await backupStorageService.deleteBackup(s3Key);
    
    res.json({
      success: true,
      message: 'Backup deleted successfully',
      data: { filename }
    });
    
  } catch (error) {
    console.error('❌ Failed to delete backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete backup',
      details: error.message
    });
  }
});

/**
 * Get all backup schedules
 * GET /api/backup/schedules
 */
router.get('/schedules', requireAdminAuth, async (req, res) => {
  try {
    console.log('📋 Getting backup schedules...');
    
    const schedules = backupSchedulerService.getSchedules();
    const templates = backupSchedulerService.getScheduleTemplates();
    
    res.json({
      success: true,
      data: {
        schedules,
        templates,
        count: schedules.length
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to get schedules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup schedules',
      details: error.message
    });
  }
});

/**
 * Create a new backup schedule
 * POST /api/backup/schedules
 */
router.post('/schedules', requireAdminAuth, async (req, res) => {
  try {
    const {
      id,
      cronExpression,
      description,
      enabled = true,
      timezone = 'UTC'
    } = req.body;

    // Validate required fields
    if (!id || !cronExpression) {
      return res.status(400).json({
        success: false,
        error: 'Schedule ID and cron expression are required'
      });
    }

    console.log(`📅 Creating backup schedule: ${id}`);
    
    const scheduleConfig = {
      cronExpression,
      description: description || `Backup schedule ${id}`,
      enabled,
      timezone,
      createdBy: 'admin', // Could be enhanced to use actual user info
      createdAt: new Date().toISOString()
    };

    const taskInfo = await backupSchedulerService.createSchedule(id, scheduleConfig);
    
    res.json({
      success: true,
      message: 'Backup schedule created successfully',
      data: {
        id: taskInfo.id,
        config: taskInfo.config,
        status: taskInfo.status,
        nextRun: taskInfo.nextRun
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to create schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup schedule',
      details: error.message
    });
  }
});

/**
 * Update a backup schedule
 * PUT /api/backup/schedules/:id
 */
router.put('/schedules/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      cronExpression,
      description,
      enabled,
      timezone
    } = req.body;

    console.log(`📝 Updating backup schedule: ${id}`);
    
    // Get existing schedule
    const schedules = backupSchedulerService.getSchedules();
    const existingSchedule = schedules.find(s => s.id === id);
    
    if (!existingSchedule) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    // Merge with existing configuration
    const updatedConfig = {
      ...existingSchedule.config,
      ...(cronExpression && { cronExpression }),
      ...(description && { description }),
      ...(enabled !== undefined && { enabled }),
      ...(timezone && { timezone }),
      updatedAt: new Date().toISOString()
    };

    // Recreate the schedule with updated configuration
    const taskInfo = await backupSchedulerService.createSchedule(id, updatedConfig);
    
    res.json({
      success: true,
      message: 'Backup schedule updated successfully',
      data: {
        id: taskInfo.id,
        config: taskInfo.config,
        status: taskInfo.status,
        nextRun: taskInfo.nextRun
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to update schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update backup schedule',
      details: error.message
    });
  }
});

/**
 * Delete a backup schedule
 * DELETE /api/backup/schedules/:id
 */
router.delete('/schedules/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Deleting backup schedule: ${id}`);
    
    await backupSchedulerService.deleteSchedule(id);
    
    res.json({
      success: true,
      message: 'Backup schedule deleted successfully',
      data: { id }
    });
    
  } catch (error) {
    console.error('❌ Failed to delete schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete backup schedule',
      details: error.message
    });
  }
});

/**
 * Start a backup schedule
 * POST /api/backup/schedules/:id/start
 */
router.post('/schedules/:id/start', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`▶️ Starting backup schedule: ${id}`);
    
    const started = backupSchedulerService.startSchedule(id);
    
    if (!started) {
      return res.status(400).json({
        success: false,
        error: 'Schedule is already running'
      });
    }
    
    res.json({
      success: true,
      message: 'Backup schedule started successfully',
      data: { id, status: 'running' }
    });
    
  } catch (error) {
    console.error('❌ Failed to start schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start backup schedule',
      details: error.message
    });
  }
});

/**
 * Stop a backup schedule
 * POST /api/backup/schedules/:id/stop
 */
router.post('/schedules/:id/stop', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`⏹️ Stopping backup schedule: ${id}`);
    
    backupSchedulerService.stopSchedule(id);
    
    res.json({
      success: true,
      message: 'Backup schedule stopped successfully',
      data: { id, status: 'stopped' }
    });
    
  } catch (error) {
    console.error('❌ Failed to stop schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop backup schedule',
      details: error.message
    });
  }
});

/**
 * Trigger a backup for a specific schedule
 * POST /api/backup/schedules/:id/trigger
 */
router.post('/schedules/:id/trigger', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔄 Triggering backup for schedule: ${id}`);
    
    const backupInfo = await backupSchedulerService.triggerBackup(id);
    
    res.json({
      success: true,
      message: 'Backup triggered successfully',
      data: backupInfo
    });
    
  } catch (error) {
    console.error('❌ Failed to trigger backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger backup',
      details: error.message
    });
  }
});

/**
 * Get execution logs for a backup schedule
 * GET /api/backup/schedules/:id/logs
 */
router.get('/schedules/:id/logs', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    
    console.log(`📋 Getting backup logs for schedule: ${id}`);
    
    const logs = await backupSchedulerService.getBackupLogs(id, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        scheduleId: id,
        logs,
        count: logs.length
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to get backup logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup logs',
      details: error.message
    });
  }
});

/**
 * Run backup cleanup manually
 * POST /api/backup/cleanup
 */
router.post('/cleanup', requireAdminAuth, async (req, res) => {
  try {
    console.log('🧹 Running manual backup cleanup...');
    
    await backupStorageService.cleanupOldBackups();
    
    // Get updated statistics
    const stats = await backupStorageService.getBackupStats();
    
    res.json({
      success: true,
      message: 'Backup cleanup completed successfully',
      data: {
        totalBackups: stats.totalBackups,
        totalSize: stats.totalSize,
        retentionPolicy: stats.retentionPolicy
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to run backup cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run backup cleanup',
      details: error.message
    });
  }
});

/**
 * Initialize backup services (mainly for troubleshooting)
 * POST /api/backup/initialize
 */
router.post('/initialize', requireAdminAuth, async (req, res) => {
  try {
    console.log('🔧 Reinitializing backup services...');
    
    // Initialize both services
    await backupStorageService.initialize();
    await backupSchedulerService.initialize();
    
    res.json({
      success: true,
      message: 'Backup services initialized successfully',
      data: {
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to initialize backup services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize backup services',
      details: error.message
    });
  }
});

/**
 * Check backup schedule configuration in CoreDB
 * GET /api/backup/schedule-config
 */
router.get('/schedule-config', requireAdminAuth, async (req, res) => {
  try {
    console.log('🔍 Checking backup schedule configuration...');
    
    // Import CoreDB dynamically
    const { default: CoreDB } = await import('../services/CoreDB.js');
    const coreDB = CoreDB.getInstance();
    
    // Get backup schedule configuration
    const scheduleConfig = await coreDB.getConfig('backup.schedules') || {};
    
    res.json({
      success: true,
      data: {
        hasSchedules: Object.keys(scheduleConfig).length > 0,
        scheduleCount: Object.keys(scheduleConfig).length,
        schedules: scheduleConfig,
        configKey: 'backup.schedules'
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to check schedule configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check schedule configuration',
      details: error.message
    });
  }
});

/**
 * Restore default backup schedules
 * POST /api/backup/restore-defaults
 */
router.post('/restore-defaults', requireAdminAuth, async (req, res) => {
  try {
    console.log('🔄 Restoring default backup schedules...');
    
    // Import CoreDB dynamically
    const { default: CoreDB } = await import('../services/CoreDB.js');
    const coreDB = CoreDB.getInstance();
    
    // Define default comprehensive backup schedules
    const defaultSchedules = {
      'daily-comprehensive': {
        enabled: true,
        cronExpression: '0 2 * * *', // 2:00 AM every day
        description: 'Daily comprehensive backup (DataDB + CoreDB) at 2:00 AM',
        backupType: 'comprehensive',
        retentionDays: 7,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      },
      'weekly-comprehensive': {
        enabled: true,
        cronExpression: '0 3 * * 0', // 3:00 AM every Sunday
        description: 'Weekly comprehensive backup (DataDB + CoreDB) on Sunday at 3:00 AM',
        backupType: 'comprehensive',
        retentionDays: 30,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      }
    };
    
    // Save to CoreDB
    await coreDB.setConfig('backup.schedules', defaultSchedules);
    
    // Reinitialize scheduler to load the new schedules
    await backupSchedulerService.initialize();
    
    res.json({
      success: true,
      message: 'Default backup schedules restored successfully',
      data: {
        schedulesCreated: Object.keys(defaultSchedules).length,
        schedules: defaultSchedules
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to restore default schedules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore default schedules',
      details: error.message
    });
  }
});

/**
 * Restore database from backup
 * POST /api/backup/restore/:filename
 */
router.post('/restore/:filename', requireAdminAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    const { type = 'auto' } = req.body; // 'datadb', 'coredb', or 'auto' (detect from filename)
    
    console.log(`🔄 Starting database restore from backup: ${filename}`);
    
    // Detect backup type from filename if not specified
    let backupType = type;
    if (type === 'auto') {
      if (filename.includes('datadb') || filename.includes('blog')) {
        backupType = 'datadb';
      } else if (filename.includes('coredb')) {
        backupType = 'coredb';
      } else {
        return res.status(400).json({
          success: false,
          error: 'Cannot determine backup type from filename. Please specify type in request body.'
        });
      }
    }
    
    // Validate backup type
    if (!['datadb', 'coredb'].includes(backupType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid backup type. Must be "datadb" or "coredb".'
      });
    }
    
    console.log(`📋 Restore type detected/specified: ${backupType}`);
    
    // Create safety backup before restore
    console.log('🛡️ Creating safety backup before restore...');
    let safetyBackupInfo;
    try {
      if (backupType === 'datadb') {
        safetyBackupInfo = await backupStorageService.createAndUploadBackup('pre-restore-safety');
      } else {
        const coreDBConnection = await databaseManager.getCoreDBConnection();
        safetyBackupInfo = await backupStorageService.createSingleDatabaseBackup(
          coreDBConnection, 
          'pre-restore-safety', 
          new Date().toISOString().replace(/[:.]/g, '-'),
          'coredb'
        );
      }
      console.log('✅ Safety backup created:', safetyBackupInfo.filename);
    } catch (safetyError) {
      console.error('⚠️ Safety backup failed, continuing with restore:', safetyError.message);
    }
    
    // Download backup from S3
    console.log('⬇️ Downloading backup file from S3...');
    const s3Key = `database-backups/${filename}`;
    const backupData = await backupStorageService.downloadBackupContent(s3Key);
    
    // Get database connection details
    let dbConnection;
    if (backupType === 'datadb') {
      dbConnection = await databaseManager.getActiveConnection();
    } else {
      dbConnection = await databaseManager.getCoreDBConnection();
    }
    
    console.log(`🔄 Restoring ${backupType} database...`);
    
    // Execute restore using psql
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');
    const fs = await import('fs');
    const path = await import('path');
    const { tmpdir } = await import('os');
    
    // Create temporary file for the backup data
    const tempFilePath = path.join(tmpdir(), `restore_${Date.now()}.sql`);
    await fs.promises.writeFile(tempFilePath, backupData);
    
    try {
      // Build psql command
      const psqlCommand = 'psql';
      const psqlArgs = [
        '-h', dbConnection.host,
        '-p', dbConnection.port.toString(),
        '-U', dbConnection.username,
        '-d', dbConnection.database,
        '-f', tempFilePath,
        '--set', 'ON_ERROR_STOP=on'
      ];
      
      console.log('🔧 Executing psql restore command...');
      
      // Execute restore
      const child = spawn(psqlCommand, psqlArgs, {
        env: {
          ...process.env,
          PGPASSWORD: dbConnection.password
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      const exitCode = await new Promise((resolve) => {
        child.on('close', resolve);
      });
      
      // Clean up temporary file
      await fs.promises.unlink(tempFilePath);
      
      if (exitCode === 0) {
        console.log('✅ Database restore completed successfully');
        
        res.json({
          success: true,
          message: `${backupType.toUpperCase()} database restored successfully from ${filename}`,
          data: {
            filename,
            backupType,
            safetyBackup: safetyBackupInfo?.filename || null,
            restoredAt: new Date().toISOString(),
            stdout: stdout.trim(),
            stderr: stderr.trim()
          }
        });
      } else {
        console.error('❌ Database restore failed:', stderr);
        res.status(500).json({
          success: false,
          error: `Database restore failed with exit code ${exitCode}`,
          details: stderr.trim()
        });
      }
      
    } catch (restoreError) {
      // Clean up temporary file on error
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (unlinkError) {
        console.error('⚠️ Failed to clean up temporary file:', unlinkError.message);
      }
      throw restoreError;
    }
    
  } catch (error) {
    console.error('❌ Failed to restore database:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore database',
      details: error.message
    });
  }
});

/**
 * Restore comprehensive backup (both DataDB and CoreDB)
 * POST /api/backup/restore-comprehensive
 */
router.post('/restore-comprehensive', requireAdminAuth, async (req, res) => {
  try {
    const { timestamp } = req.body; // Expected format: 2025-11-07T02-00-00-020Z
    
    if (!timestamp) {
      return res.status(400).json({
        success: false,
        error: 'Timestamp is required for comprehensive restore'
      });
    }
    
    console.log(`🔄 Starting comprehensive restore for timestamp: ${timestamp}`);
    
    // Find corresponding backup files
    const datadbFilename = `backup-datadb-blog-${timestamp}.sql`;
    const coredbFilename = `backup-coredb-coredb-${timestamp}.sql`;
    
    const results = {
      datadb: null,
      coredb: null,
      errors: []
    };
    
    // Create safety backups
    console.log('🛡️ Creating safety backups before comprehensive restore...');
    let safetyBackups = {};
    
    try {
      safetyBackups.datadb = await backupStorageService.createAndUploadBackup('pre-comprehensive-restore-safety');
      console.log('✅ DataDB safety backup created');
    } catch (error) {
      console.error('⚠️ DataDB safety backup failed:', error.message);
    }
    
    try {
      const coreDBConnection = await databaseManager.getCoreDBConnection();
      safetyBackups.coredb = await backupStorageService.createSingleDatabaseBackup(
        coreDBConnection, 
        'pre-comprehensive-restore-safety', 
        new Date().toISOString().replace(/[:.]/g, '-'),
        'coredb'
      );
      console.log('✅ CoreDB safety backup created');
    } catch (error) {
      console.error('⚠️ CoreDB safety backup failed:', error.message);
    }
    
    // Restore DataDB first
    try {
      console.log('🔄 Restoring DataDB...');
      const datadbResponse = await fetch(`${process.env.API_URL || 'http://localhost:5000'}/api/backup/restore/${datadbFilename}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization
        },
        body: JSON.stringify({ type: 'datadb' })
      });
      
      if (datadbResponse.ok) {
        results.datadb = await datadbResponse.json();
        console.log('✅ DataDB restore completed');
      } else {
        const error = await datadbResponse.json();
        results.errors.push(`DataDB restore failed: ${error.error}`);
        console.error('❌ DataDB restore failed:', error);
      }
    } catch (error) {
      results.errors.push(`DataDB restore error: ${error.message}`);
      console.error('❌ DataDB restore error:', error);
    }
    
    // Restore CoreDB second
    try {
      console.log('🔄 Restoring CoreDB...');
      const coredbResponse = await fetch(`${process.env.API_URL || 'http://localhost:5000'}/api/backup/restore/${coredbFilename}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization
        },
        body: JSON.stringify({ type: 'coredb' })
      });
      
      if (coredbResponse.ok) {
        results.coredb = await coredbResponse.json();
        console.log('✅ CoreDB restore completed');
      } else {
        const error = await coredbResponse.json();
        results.errors.push(`CoreDB restore failed: ${error.error}`);
        console.error('❌ CoreDB restore failed:', error);
      }
    } catch (error) {
      results.errors.push(`CoreDB restore error: ${error.message}`);
      console.error('❌ CoreDB restore error:', error);
    }
    
    const successCount = (results.datadb ? 1 : 0) + (results.coredb ? 1 : 0);
    const totalAttempts = 2;
    
    if (successCount === totalAttempts) {
      res.json({
        success: true,
        message: 'Comprehensive restore completed successfully',
        data: {
          timestamp,
          results,
          safetyBackups,
          restoredAt: new Date().toISOString(),
          successCount,
          totalAttempts
        }
      });
    } else {
      res.status(207).json({ // 207 Multi-Status
        success: false,
        message: `Comprehensive restore partially failed: ${successCount}/${totalAttempts} databases restored`,
        data: {
          timestamp,
          results,
          safetyBackups,
          errors: results.errors,
          restoredAt: new Date().toISOString(),
          successCount,
          totalAttempts
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to restore comprehensive backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore comprehensive backup',
      details: error.message
    });
  }
});

export default router;