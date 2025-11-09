import React, { useState, useEffect, useRef } from 'react';
import { useAdmin } from '../../../contexts/AdminContext';
import './HealthMonitoring.css';

const HealthMonitoring = () => {
  const { adminToken } = useAdmin();
  const [healthData, setHealthData] = useState({
    api: { status: 'checking', uptime: 0, timestamp: null },
    database: { status: 'checking', connections: 0 },
    posts: { status: 'checking', count: 0 },
    media: { status: 'checking', storage: '0MB' },
    kubernetes: { status: 'checking', pods: 0, cpu: '0%', memory: '0MB' }
  });
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [logs, setLogs] = useState([]);
  const intervalRef = useRef(null);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-9), { timestamp, message, type }]);
  };

  const checkAPIHealth = async () => {
    try {
      const response = await fetch('/health');
      if (response.ok) {
        const data = await response.json();
        return {
          status: 'healthy',
          uptime: Math.round(data.uptime || 0),
          timestamp: data.timestamp
        };
      }
      return { status: 'error', uptime: 0, timestamp: null };
    } catch (error) {
      return { status: 'error', uptime: 0, timestamp: null };
    }
  };

  const checkDatabaseHealth = async () => {
    try {
      const response = await fetch('/health/db');
      if (response.ok) {
        const data = await response.json();
        return {
          status: data.status === 'healthy' ? 'healthy' : 'error',
          connections: data.activeConnections || 0
        };
      }
      return { status: 'error', connections: 0 };
    } catch (error) {
      return { status: 'error', connections: 0 };
    }
  };

  const checkPostsHealth = async () => {
    try {
      const response = await fetch('/api/posts');
      if (response.ok) {
        const data = await response.json();
        return {
          status: 'healthy',
          count: Array.isArray(data) ? data.length : 0
        };
      }
      return { status: 'error', count: 0 };
    } catch (error) {
      return { status: 'error', count: 0 };
    }
  };

  const checkMediaHealth = async () => {
    try {
      const response = await fetch('/api/media');
      if (response.ok) {
        const data = await response.json();
        const totalSize = Array.isArray(data) ? 
          data.reduce((sum, item) => sum + (item.file_size || 0), 0) : 0;
        const sizeMB = Math.round(totalSize / 1024 / 1024);
        return {
          status: 'healthy',
          storage: `${sizeMB}MB`
        };
      }
      return { status: 'error', storage: '0MB' };
    } catch (error) {
      return { status: 'error', storage: '0MB' };
    }
  };

  const checkKubernetesHealth = async () => {
    try {
      const response = await fetch('/api/admin/system-status', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        return {
          status: data.kubernetes.status === 'healthy' ? 'healthy' : 
                  data.kubernetes.status === 'not_available' ? 'checking' : 'error',
          pods: data.kubernetes.pods || 0,
          cpu: data.kubernetes.cpu || '0%',
          memory: data.kubernetes.memory || '0MB'
        };
      }
      return { status: 'error', pods: 0, cpu: '0%', memory: '0MB' };
    } catch (error) {
      return { status: 'error', pods: 0, cpu: '0%', memory: '0MB' };
    }
  };

  const runHealthCheck = async () => {
    addLog('Starting health check...', 'info');
    
    try {
      const [api, database, posts, media, kubernetes] = await Promise.all([
        checkAPIHealth(),
        checkDatabaseHealth(),
        checkPostsHealth(),
        checkMediaHealth(),
        checkKubernetesHealth()
      ]);

      setHealthData({ api, database, posts, media, kubernetes });

      // Count failed checks
      const failedChecks = [api, database, posts, media, kubernetes]
        .filter(check => check.status === 'error').length;

      if (failedChecks === 0) {
        addLog('✅ All systems healthy', 'success');
      } else if (failedChecks <= 2) {
        addLog(`⚠️ ${failedChecks} component(s) unhealthy`, 'warning');
      } else {
        addLog(`❌ ${failedChecks} critical failures detected`, 'error');
      }
    } catch (error) {
      addLog(`❌ Health check failed: ${error.message}`, 'error');
    }
  };

  const startMonitoring = () => {
    setIsMonitoring(true);
    addLog('🔄 Continuous monitoring started', 'info');
    runHealthCheck();
    intervalRef.current = setInterval(runHealthCheck, 30000); // Check every 30 seconds
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    addLog('⏸️ Monitoring stopped', 'info');
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('📋 Logs cleared', 'info');
  };

  useEffect(() => {
    // Run initial health check
    runHealthCheck();
    
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return '#4CAF50';
      case 'error': return '#f44336';
      case 'checking': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'error': return '❌';
      case 'checking': return '⏳';
      default: return '❓';
    }
  };

  return (
    <div className="health-monitoring">
      <div className="health-header">
        <h2>System Health Monitoring</h2>
        <div className="health-controls">
          {!isMonitoring ? (
            <button className="btn btn-primary" onClick={startMonitoring}>
              Start Monitoring
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={stopMonitoring}>
              Stop Monitoring
            </button>
          )}
          <button className="btn btn-outline" onClick={runHealthCheck}>
            Check Now
          </button>
          <button className="btn btn-outline" onClick={clearLogs}>
            Clear Logs
          </button>
        </div>
      </div>

      <div className="health-grid">
        {/* API Health */}
        <div className="health-card">
          <div className="health-card-header">
            <span className="health-icon">{getStatusIcon(healthData.api.status)}</span>
            <h3>API Server</h3>
            <span 
              className="health-status" 
              style={{ color: getStatusColor(healthData.api.status) }}
            >
              {healthData.api.status}
            </span>
          </div>
          <div className="health-card-body">
            <div className="health-metric">
              <span className="metric-label">Uptime:</span>
              <span className="metric-value">{healthData.api.uptime}s</span>
            </div>
            <div className="health-metric">
              <span className="metric-label">Last Check:</span>
              <span className="metric-value">
                {healthData.api.timestamp ? 
                  new Date(healthData.api.timestamp).toLocaleTimeString() : 
                  'Never'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Database Health */}
        <div className="health-card">
          <div className="health-card-header">
            <span className="health-icon">{getStatusIcon(healthData.database.status)}</span>
            <h3>Database</h3>
            <span 
              className="health-status" 
              style={{ color: getStatusColor(healthData.database.status) }}
            >
              {healthData.database.status}
            </span>
          </div>
          <div className="health-card-body">
            <div className="health-metric">
              <span className="metric-label">Active Connections:</span>
              <span className="metric-value">{healthData.database.connections}</span>
            </div>
          </div>
        </div>

        {/* Posts Health */}
        <div className="health-card">
          <div className="health-card-header">
            <span className="health-icon">{getStatusIcon(healthData.posts.status)}</span>
            <h3>Posts API</h3>
            <span 
              className="health-status" 
              style={{ color: getStatusColor(healthData.posts.status) }}
            >
              {healthData.posts.status}
            </span>
          </div>
          <div className="health-card-body">
            <div className="health-metric">
              <span className="metric-label">Published Posts:</span>
              <span className="metric-value">{healthData.posts.count}</span>
            </div>
          </div>
        </div>

        {/* Media Health */}
        <div className="health-card">
          <div className="health-card-header">
            <span className="health-icon">{getStatusIcon(healthData.media.status)}</span>
            <h3>Media Storage</h3>
            <span 
              className="health-status" 
              style={{ color: getStatusColor(healthData.media.status) }}
            >
              {healthData.media.status}
            </span>
          </div>
          <div className="health-card-body">
            <div className="health-metric">
              <span className="metric-label">Storage Used:</span>
              <span className="metric-value">{healthData.media.storage}</span>
            </div>
          </div>
        </div>

        {/* Kubernetes Health */}
        <div className="health-card">
          <div className="health-card-header">
            <span className="health-icon">{getStatusIcon(healthData.kubernetes.status)}</span>
            <h3>Kubernetes</h3>
            <span 
              className="health-status" 
              style={{ color: getStatusColor(healthData.kubernetes.status) }}
            >
              {healthData.kubernetes.status}
            </span>
          </div>
          <div className="health-card-body">
            <div className="health-metric">
              <span className="metric-label">Pods:</span>
              <span className="metric-value">{healthData.kubernetes.pods}</span>
            </div>
            <div className="health-metric">
              <span className="metric-label">CPU:</span>
              <span className="metric-value">{healthData.kubernetes.cpu}</span>
            </div>
            <div className="health-metric">
              <span className="metric-label">Memory:</span>
              <span className="metric-value">{healthData.kubernetes.memory}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monitoring Logs */}
      <div className="health-logs">
        <h3>Monitoring Logs</h3>
        <div className="logs-container">
          {logs.map((log, index) => (
            <div 
              key={index} 
              className={`log-entry log-${log.type}`}
            >
              <span className="log-timestamp">{log.timestamp}</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="log-entry">
              <span className="log-message">No logs yet...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HealthMonitoring;