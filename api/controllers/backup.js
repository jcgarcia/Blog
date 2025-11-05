import express from 'express';
import { requireAdminAuth } from './admin.js';
import { backupStorageService } from '../services/backupStorageService.js';
import { backupSchedulerService } from '../services/backupSchedulerService.js';

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
 */
router.post('/create', requireAdminAuth, async (req, res) => {
  try {
    console.log('🔄 Creating manual backup...');
    
    const backupInfo = await backupStorageService.createAndUploadBackup('manual');
    
    res.json({
      success: true,
      message: 'Backup created successfully',
      data: backupInfo
    });
    
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

export default router;