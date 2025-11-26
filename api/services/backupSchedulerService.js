import cron from 'node-cron';
import backupStorageService from './backupStorageService.js';
import CoreDB from './CoreDB.js';

/**
 * Backup Scheduler Service
 * Manages cron-based database backup scheduling
 * Integrates with BackupStorageService for actual backup operations
 */
class BackupSchedulerService {
  constructor() {
    this.scheduledTasks = new Map();
    this.isInitialized = false;
    this.defaultSchedules = {
      'daily': '0 2 * * *',        // 2:00 AM every day
      'weekly': '0 3 * * 0',       // 3:00 AM every Sunday
      'twice-daily': '0 2,14 * * *', // 2:00 AM and 2:00 PM every day
      'hourly': '0 * * * *'        // Every hour
    };
  }

  /**
   * Initialize the backup scheduler
   */
  async initialize() {
    try {
      console.log('🔧 Initializing BackupSchedulerService...');
      
      // Load existing schedules from CoreDB
      await this.loadSchedulesFromConfig();
      
      this.isInitialized = true;
      console.log('✅ BackupSchedulerService initialized successfully');
      console.log(`📊 Loaded ${this.scheduledTasks.size} scheduled backup jobs`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize BackupSchedulerService:', error);
      throw error;
    }
  }

  /**
   * Load backup schedules from CoreDB configuration
   */
  async loadSchedulesFromConfig() {
    try {
      const coreDB = CoreDB.getInstance();
      const scheduleConfig = await coreDB.getConfig('backup.schedules') || {};
      
      console.log('📋 Loading backup schedules from configuration...');
      
      // Clear existing tasks
      this.stopAllSchedules();
      
      // Load and start each configured schedule
      for (const [scheduleId, config] of Object.entries(scheduleConfig)) {
        if (config.enabled) {
          await this.createSchedule(scheduleId, config, false); // Don't save to config
          console.log(`✅ Loaded schedule: ${scheduleId} (${config.cronExpression})`);
        } else {
          console.log(`⏸️ Skipped disabled schedule: ${scheduleId}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to load schedules from config:', error);
      // Don't throw - service should start even if no schedules are configured
    }
  }

  /**
   * Create a new backup schedule
   * @param {string} scheduleId - Unique identifier for the schedule
   * @param {Object} scheduleConfig - Schedule configuration
   * @param {boolean} saveToConfig - Whether to save to CoreDB config
   */
  async createSchedule(scheduleId, scheduleConfig, saveToConfig = true) {
    try {
      console.log(`📅 Creating backup schedule: ${scheduleId}`);
      
      // Validate schedule configuration
      this.validateScheduleConfig(scheduleConfig);
      
      // Stop existing schedule if it exists
      if (this.scheduledTasks.has(scheduleId)) {
        this.stopSchedule(scheduleId);
      }

      // Create cron task
      const cronTask = cron.schedule(scheduleConfig.cronExpression, async () => {
        console.log(`⏰ Executing scheduled backup: ${scheduleId}`);
        await this.executeScheduledBackup(scheduleId, scheduleConfig);
      }, {
        scheduled: false, // Don't start immediately
        name: scheduleId,
        timezone: scheduleConfig.timezone || 'UTC'
      });

      // Store task information
      const taskInfo = {
        id: scheduleId,
        task: cronTask,
        config: { ...scheduleConfig },
        createdAt: new Date().toISOString(),
        lastRun: null,
        nextRun: null,
        status: 'stopped'
      };

      this.scheduledTasks.set(scheduleId, taskInfo);

      // Start the task if enabled
      if (scheduleConfig.enabled !== false) {
        this.startSchedule(scheduleId);
      }

      // Save to CoreDB configuration if requested
      if (saveToConfig) {
        await this.saveScheduleToConfig(scheduleId, scheduleConfig);
      }

      console.log(`✅ Backup schedule created: ${scheduleId}`);
      console.log(`📊 Next run: ${this.getNextRunTime(scheduleId)}`);
      
      return taskInfo;
      
    } catch (error) {
      console.error(`❌ Failed to create schedule ${scheduleId}:`, error);
      throw error;
    }
  }

  /**
   * Start a specific backup schedule
   * @param {string} scheduleId - Schedule ID to start
   */
  startSchedule(scheduleId) {
    const taskInfo = this.scheduledTasks.get(scheduleId);
    if (!taskInfo) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    if (taskInfo.status === 'running') {
      console.log(`⚠️ Schedule ${scheduleId} is already running`);
      return false;
    }

    taskInfo.task.start();
    taskInfo.status = 'running';
    taskInfo.nextRun = this.getNextRunTime(scheduleId);
    
    console.log(`▶️ Started backup schedule: ${scheduleId}`);
    return true;
  }

  /**
   * Stop a specific backup schedule
   * @param {string} scheduleId - Schedule ID to stop
   */
  stopSchedule(scheduleId) {
    const taskInfo = this.scheduledTasks.get(scheduleId);
    if (!taskInfo) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    taskInfo.task.stop();
    taskInfo.status = 'stopped';
    taskInfo.nextRun = null;
    
    console.log(`⏹️ Stopped backup schedule: ${scheduleId}`);
    return true;
  }

  /**
   * Delete a backup schedule
   * @param {string} scheduleId - Schedule ID to delete
   */
  async deleteSchedule(scheduleId) {
    try {
      const taskInfo = this.scheduledTasks.get(scheduleId);
      if (!taskInfo) {
        throw new Error(`Schedule not found: ${scheduleId}`);
      }

      // Stop and destroy the task
      taskInfo.task.destroy();
      this.scheduledTasks.delete(scheduleId);

      // Remove from CoreDB configuration
      await this.removeScheduleFromConfig(scheduleId);

      console.log(`🗑️ Deleted backup schedule: ${scheduleId}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to delete schedule ${scheduleId}:`, error);
      throw error;
    }
  }

  /**
   * Get all scheduled backup tasks
   * @returns {Array} List of schedule information
   */
  getSchedules() {
    const schedules = [];
    
    for (const [scheduleId, taskInfo] of this.scheduledTasks) {
      schedules.push({
        id: scheduleId,
        config: taskInfo.config,
        status: taskInfo.status,
        createdAt: taskInfo.createdAt,
        lastRun: taskInfo.lastRun,
        nextRun: taskInfo.nextRun,
        isValid: cron.validate(taskInfo.config.cronExpression)
      });
    }
    
    return schedules.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Execute a scheduled backup
   * @param {string} scheduleId - Schedule ID
   * @param {Object} scheduleConfig - Schedule configuration
   */
  async executeScheduledBackup(scheduleId, scheduleConfig) {
    try {
      console.log(`🔄 Executing scheduled backup: ${scheduleId}`);
      const backupType = scheduleConfig.backupType || 'datadb'; // Default to datadb for backward compatibility
      
      const startTime = Date.now();
      let backupInfo;
      
      // Create backup based on configured type
      if (backupType === 'comprehensive') {
        console.log(`📊 Running comprehensive scheduled backup (DataDB + CoreDB)`);
        backupInfo = await backupStorageService.createComprehensiveBackup('scheduled');
      } else {
        console.log(`📊 Running single database scheduled backup: ${backupType}`);
        backupInfo = await backupStorageService.createAndUploadBackup('scheduled');
      }
      
      const duration = Date.now() - startTime;
      
      // Update task information
      const taskInfo = this.scheduledTasks.get(scheduleId);
      if (taskInfo) {
        taskInfo.lastRun = new Date().toISOString();
        taskInfo.nextRun = this.getNextRunTime(scheduleId);
      }

      console.log(`✅ Scheduled backup completed: ${scheduleId}`);
      
      if (backupType === 'comprehensive') {
        console.log(`📊 Duration: ${duration}ms, Databases: ${backupInfo.successfulBackups}/${backupInfo.totalBackups}, Total Size: ${(backupInfo.totalSize / 1024 / 1024).toFixed(2)} MB`);
      } else {
        console.log(`📊 Duration: ${duration}ms, Size: ${(backupInfo.size / 1024 / 1024).toFixed(2)} MB`);
      }
      
      // Log successful backup to CoreDB for monitoring
      await this.logBackupExecution(scheduleId, {
        status: 'success',
        duration,
        backupInfo,
        backupType,
        timestamp: new Date().toISOString()
      });
      
      return backupInfo;
      
    } catch (error) {
      console.error(`❌ Scheduled backup failed: ${scheduleId}`, error);
      
      // Log failed backup to CoreDB for monitoring
      await this.logBackupExecution(scheduleId, {
        status: 'failure',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Don't throw - cron should continue running even if backup fails
    }
  }

  /**
   * Manually trigger a backup for a specific schedule
   * @param {string} scheduleId - Schedule ID to trigger
   */
  async triggerBackup(scheduleId) {
    try {
      const taskInfo = this.scheduledTasks.get(scheduleId);
      if (!taskInfo) {
        throw new Error(`Schedule not found: ${scheduleId}`);
      }

      console.log(`🔄 Manually triggering backup for schedule: ${scheduleId}`);
      
      const backupInfo = await this.executeScheduledBackup(scheduleId, taskInfo.config);
      return backupInfo;
      
    } catch (error) {
      console.error(`❌ Failed to trigger backup ${scheduleId}:`, error);
      throw error;
    }
  }

  /**
   * Get the next run time for a schedule
   * @param {string} scheduleId - Schedule ID
   * @returns {string|null} Next run time in ISO format
   */
  getNextRunTime(scheduleId) {
    try {
      const taskInfo = this.scheduledTasks.get(scheduleId);
      if (!taskInfo || taskInfo.status !== 'running') {
        return null;
      }

      // Use a cron library to calculate next execution time
      const cronExpression = taskInfo.config.cronExpression;
      if (!cron.validate(cronExpression)) {
        return null;
      }

      // Simple next run calculation (this could be enhanced with a proper cron parser)
      const now = new Date();
      const next = new Date(now.getTime() + 60000); // Approximate - next minute
      return next.toISOString();
      
    } catch (error) {
      console.error(`❌ Failed to get next run time for ${scheduleId}:`, error);
      return null;
    }
  }

  /**
   * Stop all scheduled backup tasks
   */
  stopAllSchedules() {
    console.log('⏹️ Stopping all backup schedules...');
    
    for (const [scheduleId, taskInfo] of this.scheduledTasks) {
      if (taskInfo.status === 'running') {
        taskInfo.task.stop();
        taskInfo.status = 'stopped';
        console.log(`⏹️ Stopped schedule: ${scheduleId}`);
      }
    }
  }

  /**
   * Validate schedule configuration
   * @param {Object} config - Schedule configuration to validate
   */
  validateScheduleConfig(config) {
    if (!config.cronExpression) {
      throw new Error('cronExpression is required');
    }

    if (!cron.validate(config.cronExpression)) {
      throw new Error(`Invalid cron expression: ${config.cronExpression}`);
    }

    if (config.timezone && !this.isValidTimezone(config.timezone)) {
      throw new Error(`Invalid timezone: ${config.timezone}`);
    }
  }

  /**
   * Check if timezone is valid (simplified check)
   * @param {string} timezone - Timezone to validate
   */
  isValidTimezone(timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Save schedule configuration to CoreDB
   * @param {string} scheduleId - Schedule ID
   * @param {Object} config - Schedule configuration
   */
  async saveScheduleToConfig(scheduleId, config) {
    try {
      const coreDB = CoreDB.getInstance();
      const configKey = `backup.schedules.${scheduleId}`;
      await coreDB.setConfig(configKey, config);
      console.log(`💾 Saved schedule configuration: ${scheduleId}`);
    } catch (error) {
      console.error(`❌ Failed to save schedule config ${scheduleId}:`, error);
      // Don't throw - schedule can still work without being saved
    }
  }

  /**
   * Remove schedule configuration from CoreDB
   * @param {string} scheduleId - Schedule ID
   */
  async removeScheduleFromConfig(scheduleId) {
    try {
      const coreDB = CoreDB.getInstance();
      const configKey = `backup.schedules.${scheduleId}`;
      await coreDB.deleteConfig(configKey);
      console.log(`🗑️ Removed schedule configuration: ${scheduleId}`);
    } catch (error) {
      console.error(`❌ Failed to remove schedule config ${scheduleId}:`, error);
      // Don't throw - deletion can still proceed
    }
  }

  /**
   * Log backup execution results to CoreDB
   * @param {string} scheduleId - Schedule ID
   * @param {Object} logData - Execution log data
   */
  async logBackupExecution(scheduleId, logData) {
    try {
      const coreDB = CoreDB.getInstance();
      
      // Get existing logs (keep last 50 entries per schedule)
      const logsKey = `backup.logs.${scheduleId}`;
      let logs = await coreDB.getConfig(logsKey) || [];
      
      // Add new log entry
      logs.unshift(logData);
      
      // Keep only last 50 entries
      if (logs.length > 50) {
        logs = logs.slice(0, 50);
      }
      
      await coreDB.setConfig(logsKey, logs);
      
    } catch (error) {
      console.error(`❌ Failed to log backup execution ${scheduleId}:`, error);
      // Don't throw - logging failures shouldn't break backups
    }
  }

  /**
   * Get backup execution logs for a schedule
   * @param {string} scheduleId - Schedule ID
   * @param {number} limit - Maximum number of log entries to return
   */
  async getBackupLogs(scheduleId, limit = 20) {
    try {
      const coreDB = CoreDB.getInstance();
      const logsKey = `backup.logs.${scheduleId}`;
      const logs = await coreDB.getConfig(logsKey) || [];
      
      return logs.slice(0, limit);
      
    } catch (error) {
      console.error(`❌ Failed to get backup logs ${scheduleId}:`, error);
      return [];
    }
  }

  /**
   * Get predefined schedule templates
   * @returns {Object} Schedule templates
   */
  getScheduleTemplates() {
    return {
      ...this.defaultSchedules,
      custom: null // Placeholder for custom cron expressions
    };
  }
}

// Export singleton instance
const backupSchedulerService = new BackupSchedulerService();
export default backupSchedulerService;