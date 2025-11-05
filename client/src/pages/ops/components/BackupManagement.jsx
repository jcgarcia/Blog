import React, { useState, useEffect } from 'react';
import { useAdmin } from '../../../contexts/AdminContext';
import './BackupManagement.css';

const BackupManagement = () => {
  const { isAdmin } = useAdmin();
  const [loading, setLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [scheduleTemplates, setScheduleTemplates] = useState({});
  const [activeTab, setActiveTab] = useState('status');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // New schedule form state
  const [newScheduleForm, setNewScheduleForm] = useState({
    id: '',
    cronExpression: '',
    description: '',
    enabled: true,
    template: ''
  });

  const predefinedSchedules = {
    'daily': { 
      cron: '0 2 * * *', 
      description: 'Daily at 2:00 AM',
      label: 'Daily' 
    },
    'weekly': { 
      cron: '0 3 * * 0', 
      description: 'Weekly on Sunday at 3:00 AM',
      label: 'Weekly' 
    },
    'twice-daily': { 
      cron: '0 2,14 * * *', 
      description: 'Twice daily at 2:00 AM and 2:00 PM',
      label: 'Twice Daily' 
    },
    'hourly': { 
      cron: '0 * * * *', 
      description: 'Every hour',
      label: 'Hourly' 
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadBackups().then(() => loadBackupStatus());
      loadSchedules();
    }
  }, [isAdmin]);

  const apiRequest = async (url, options = {}) => {
    const token = localStorage.getItem('adminToken');
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  };

  const loadBackupStatus = async () => {
    try {
      setLoading(true);
      // Use the existing database endpoint for status
      const connectionStatus = await apiRequest('/api/database/connection-status');
      const healthStatus = await apiRequest('/api/database/health');
      
      setBackupStatus({
        storage: {
          totalBackups: backups.length,
          totalSize: backups.reduce((sum, backup) => sum + (backup.size || 0), 0),
          latestBackup: backups.length > 0 ? backups[0] : null,
          withinRetentionPolicy: true,
          retentionPolicy: {
            currentCount: backups.length,
            maxBackups: 10
          }
        },
        scheduler: {
          totalSchedules: 0, // Scheduling feature not implemented yet
          activeSchedules: 0,
          inactiveSchedules: 0
        }
      });
    } catch (err) {
      setError(`Failed to load backup status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    try {
      // Use the existing database backups endpoint
      const data = await apiRequest('/api/database/backups');
      setBackups(data.backups || []);
    } catch (err) {
      setError(`Failed to load backups: ${err.message}`);
    }
  };

  const loadSchedules = async () => {
    try {
      // Scheduling feature not implemented yet - use empty arrays
      setSchedules([]);
      setScheduleTemplates({});
    } catch (err) {
      setError(`Failed to load schedules: ${err.message}`);
    }
  };

  const createManualBackup = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // Use the existing database backup endpoint (streams backup directly)
      const response = await fetch('/api/database/backup', {
        method: 'GET', // The existing endpoint uses GET to stream the backup
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `backup-${new Date().toISOString().split('T')[0]}.sql`;
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess(`Manual backup downloaded successfully: ${filename}`);
      await loadBackups();
      await loadBackupStatus();
    } catch (err) {
      setError(`Failed to create backup: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadBackup = async (filename) => {
    try {
      // Note: The existing system streams backups directly, doesn't store them
      // This function is kept for UI compatibility but won't work with stored backups
      setError('Download not available - backups are generated on-demand. Use "Create Manual Backup" instead.');
    } catch (err) {
      setError(`Failed to download backup: ${err.message}`);
    }
  };

  const deleteBackup = async (filename) => {
    try {
      // Note: The existing system doesn't store backups, so delete is not applicable
      setError('Delete not available - backups are generated on-demand and not stored on server.');
    } catch (err) {
      setError(`Failed to delete backup: ${err.message}`);
    }
  };

  const createSchedule = async () => {
    try {
      setError(null);
      setSuccess(null);

      if (!newScheduleForm.id || !newScheduleForm.cronExpression) {
        setError('Schedule ID and cron expression are required');
        return;
      }

      await apiRequest('/api/backup/schedules', {
        method: 'POST',
        body: JSON.stringify(newScheduleForm)
      });

      setSuccess(`Schedule created: ${newScheduleForm.id}`);
      setNewScheduleForm({
        id: '',
        cronExpression: '',
        description: '',
        enabled: true,
        template: ''
      });
      await loadSchedules();
    } catch (err) {
      setError(`Failed to create schedule: ${err.message}`);
    }
  };

  const toggleSchedule = async (scheduleId, currentStatus) => {
    try {
      const action = currentStatus === 'running' ? 'stop' : 'start';
      await apiRequest(`/api/backup/schedules/${scheduleId}/${action}`, {
        method: 'POST'
      });
      
      await loadSchedules();
      setSuccess(`Schedule ${scheduleId} ${action}ed successfully`);
    } catch (err) {
      setError(`Failed to ${action} schedule: ${err.message}`);
    }
  };

  const triggerSchedule = async (scheduleId) => {
    try {
      setLoading(true);
      await apiRequest(`/api/backup/schedules/${scheduleId}/trigger`, {
        method: 'POST'
      });
      
      setSuccess(`Backup triggered for schedule: ${scheduleId}`);
      await loadBackups();
      await loadBackupStatus();
    } catch (err) {
      setError(`Failed to trigger backup: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteSchedule = async (scheduleId) => {
    if (!confirm(`Are you sure you want to delete schedule: ${scheduleId}?`)) {
      return;
    }

    try {
      await apiRequest(`/api/backup/schedules/${scheduleId}`, {
        method: 'DELETE'
      });
      
      setSuccess(`Schedule deleted: ${scheduleId}`);
      await loadSchedules();
    } catch (err) {
      setError(`Failed to delete schedule: ${err.message}`);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const handleTemplateChange = (template) => {
    if (template && predefinedSchedules[template]) {
      setNewScheduleForm({
        ...newScheduleForm,
        template,
        cronExpression: predefinedSchedules[template].cron,
        description: predefinedSchedules[template].description
      });
    }
  };

  const renderStatusTab = () => (
    <div className="backup-status">
      <div className="status-cards">
        <div className="status-card">
          <h3>Storage Status</h3>
          {backupStatus?.storage ? (
            <div className="status-details">
              <div className="status-item">
                <span className="label">Total Backups:</span>
                <span className="value">{backupStatus.storage.totalBackups}</span>
              </div>
              <div className="status-item">
                <span className="label">Total Size:</span>
                <span className="value">{formatBytes(backupStatus.storage.totalSize)}</span>
              </div>
              <div className="status-item">
                <span className="label">Latest Backup:</span>
                <span className="value">
                  {backupStatus.storage.latestBackup 
                    ? formatDate(backupStatus.storage.latestBackup.lastModified)
                    : 'No backups'
                  }
                </span>
              </div>
              <div className="status-item">
                <span className="label">Retention Policy:</span>
                <span className={`value ${backupStatus.storage.withinRetentionPolicy ? 'success' : 'warning'}`}>
                  {backupStatus.storage.retentionPolicy.currentCount} / {backupStatus.storage.retentionPolicy.maxBackups} backups
                </span>
              </div>
            </div>
          ) : (
            <div>Loading...</div>
          )}
        </div>

        <div className="status-card">
          <h3>Scheduler Status</h3>
          {backupStatus?.scheduler ? (
            <div className="status-details">
              <div className="status-item">
                <span className="label">Total Schedules:</span>
                <span className="value">{backupStatus.scheduler.totalSchedules}</span>
              </div>
              <div className="status-item">
                <span className="label">Active Schedules:</span>
                <span className="value success">{backupStatus.scheduler.activeSchedules}</span>
              </div>
              <div className="status-item">
                <span className="label">Inactive Schedules:</span>
                <span className="value">{backupStatus.scheduler.inactiveSchedules}</span>
              </div>
            </div>
          ) : (
            <div>Loading...</div>
          )}
        </div>
      </div>

      <div className="action-buttons">
        <button 
          className="btn btn-primary" 
          onClick={createManualBackup}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Manual Backup'}
        </button>
      </div>
    </div>
  );

  const renderBackupsTab = () => (
          <div className="backup-list">
        <div className="feature-notice">
          <h3>📄 On-Demand Backup System</h3>
          <p>
            This system generates database backups on-demand and streams them directly to your browser for download. 
            Backups are not stored on the server for security and storage efficiency.
          </p>
          <p>
            <strong>To create a backup:</strong> Use the "Create Manual Backup" button in the Status tab or visit the 
            <strong> Database</strong> panel where this functionality was originally implemented.
          </p>
        </div>
        
        <div className="backup-actions-info">
          <h4>Available Backup Operations:</h4>
          <ul>
            <li><strong>Manual Backup:</strong> Generate and download a complete database backup</li>
            <li><strong>Table Export:</strong> Export specific tables (available in Database panel)</li>
            <li><strong>Database Restore:</strong> Upload and restore from backup files (available in Database panel)</li>
          </ul>
        </div>
      </div>
  );

  const renderSchedulesTab = () => (
    <div className="backup-schedules">
      <div className="feature-notice">
        <h3>🚧 Scheduled Backups - Coming Soon</h3>
        <p>Automated backup scheduling is planned for a future release. Currently, you can create manual backups using the existing functionality in the <strong>Database</strong> panel or by clicking "Create Manual Backup" in the Status tab.</p>
      </div>
      <div className="create-schedule" style={{opacity: 0.5, pointerEvents: 'none'}}>
        <h3>Create New Schedule (Not Available Yet)</h3>
        <div className="schedule-form">
          <div className="form-row">
            <div className="form-group">
              <label>Schedule ID:</label>
              <input
                type="text"
                value={newScheduleForm.id}
                onChange={(e) => setNewScheduleForm({...newScheduleForm, id: e.target.value})}
                placeholder="e.g., daily-backup"
              />
            </div>
            <div className="form-group">
              <label>Template:</label>
              <select
                value={newScheduleForm.template}
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                <option value="">Custom</option>
                {Object.entries(predefinedSchedules).map(([key, schedule]) => (
                  <option key={key} value={key}>{schedule.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Cron Expression:</label>
              <input
                type="text"
                value={newScheduleForm.cronExpression}
                onChange={(e) => setNewScheduleForm({...newScheduleForm, cronExpression: e.target.value})}
                placeholder="0 2 * * *"
              />
            </div>
            <div className="form-group">
              <label>Description:</label>
              <input
                type="text"
                value={newScheduleForm.description}
                onChange={(e) => setNewScheduleForm({...newScheduleForm, description: e.target.value})}
                placeholder="Daily backup at 2 AM"
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={createSchedule}>
              Create Schedule
            </button>
          </div>
        </div>
      </div>

      <div className="existing-schedules">
        <h3>Existing Schedules ({schedules.length})</h3>
        {schedules.length === 0 ? (
          <div className="no-data">No schedules configured.</div>
        ) : (
          <div className="schedules-grid">
            {schedules.map((schedule) => (
              <div key={schedule.id} className={`schedule-card ${schedule.status}`}>
                <div className="schedule-header">
                  <h4>{schedule.id}</h4>
                  <span className={`status-badge ${schedule.status}`}>
                    {schedule.status}
                  </span>
                </div>
                <div className="schedule-details">
                  <div className="detail-item">
                    <span className="label">Cron:</span>
                    <span className="value">{schedule.config.cronExpression}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Description:</span>
                    <span className="value">{schedule.config.description || 'No description'}</span>
                  </div>
                  {schedule.nextRun && (
                    <div className="detail-item">
                      <span className="label">Next Run:</span>
                      <span className="value">{formatDate(schedule.nextRun)}</span>
                    </div>
                  )}
                  {schedule.lastRun && (
                    <div className="detail-item">
                      <span className="label">Last Run:</span>
                      <span className="value">{formatDate(schedule.lastRun)}</span>
                    </div>
                  )}
                </div>
                <div className="schedule-actions">
                  <button
                    className={`btn btn-small ${schedule.status === 'running' ? 'btn-warning' : 'btn-success'}`}
                    onClick={() => toggleSchedule(schedule.id, schedule.status)}
                  >
                    {schedule.status === 'running' ? 'Stop' : 'Start'}
                  </button>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => triggerSchedule(schedule.id)}
                    disabled={loading}
                  >
                    Trigger Now
                  </button>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => deleteSchedule(schedule.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (!isAdmin) {
    return <div className="backup-management">Please log in to access backup management.</div>;
  }

  return (
    <div className="backup-management">
      <div className="backup-header">
        <h2>Database Backup Management</h2>
        <p>Schedule and manage automated database backups with S3 storage and retention policies.</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-close" onClick={() => setError(null)}>×</span>
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span className="alert-close" onClick={() => setSuccess(null)}>×</span>
          {success}
        </div>
      )}

      <div className="backup-tabs">
        <button 
          className={`tab-button ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          📊 Status
        </button>
        <button 
          className={`tab-button ${activeTab === 'backups' ? 'active' : ''}`}
          onClick={() => setActiveTab('backups')}
        >
          💿 Backups
        </button>
        <button 
          className={`tab-button ${activeTab === 'schedules' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedules')}
        >
          📅 Schedules
        </button>
      </div>

      <div className="backup-content">
        {activeTab === 'status' && renderStatusTab()}
        {activeTab === 'backups' && renderBackupsTab()}
        {activeTab === 'schedules' && renderSchedulesTab()}
      </div>
    </div>
  );
};

export default BackupManagement;