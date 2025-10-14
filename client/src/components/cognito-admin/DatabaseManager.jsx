import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../../config/api';
import './cognito-admin.css';

const DatabaseManager = () => {
  const [healthStatus, setHealthStatus] = useState(null);
  const [connections, setConnections] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [testResults, setTestResults] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load database health status and connections on component mount
  useEffect(() => {
    loadDatabaseStatus();
    const interval = autoRefresh ? setInterval(loadDatabaseStatus, 10000) : null; // Refresh every 10 seconds
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadDatabaseStatus = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setMessage('❌ No admin token found. Please login first.');
        return;
      }

      // Load health status and connections in parallel
      const [healthResponse, connectionsResponse] = await Promise.all([
        fetch(API_ENDPOINTS.DATABASE.HEALTH, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(API_ENDPOINTS.DATABASE.CONNECTIONS, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (healthResponse.ok && connectionsResponse.ok) {
        const healthData = await healthResponse.json();
        const connectionsData = await connectionsResponse.json();
        
        setHealthStatus(healthData);
        setConnections(connectionsData);
        setMessage('');
      } else {
        setMessage('❌ Failed to load database status. Check your admin permissions.');
      }
    } catch (error) {
      console.error('Error loading database status:', error);
      setMessage('❌ Error loading database status: ' + error.message);
    }
  };

  const switchDatabase = async (database) => {
    if (!database || !['rds', 'container'].includes(database)) {
      setMessage('❌ Invalid database selection');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setMessage('❌ No admin token found');
        setLoading(false);
        return;
      }

      const response = await fetch(API_ENDPOINTS.DATABASE.SWITCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ database })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage(`✅ Successfully switched to ${database.toUpperCase()} database`);
        // Reload status after switching
        setTimeout(loadDatabaseStatus, 1000);
      } else {
        setMessage(`❌ Failed to switch database: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error switching database:', error);
      setMessage('❌ Error switching database: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (database) => {
    setTestResults(prev => ({ ...prev, [database]: { testing: true } }));
    
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_ENDPOINTS.DATABASE.TEST}/${database}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      
      setTestResults(prev => ({
        ...prev,
        [database]: {
          testing: false,
          success: response.ok && data.success,
          data: data.success ? data : null,
          error: data.success ? null : data.message || 'Test failed'
        }
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [database]: {
          testing: false,
          success: false,
          error: error.message
        }
      }));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return '🟢';
      case 'error': return '🔴';
      case 'unavailable': return '⚪';
      default: return '🟡';
    }
  };

  const formatResponseTime = (responseTime) => {
    if (!responseTime) return 'N/A';
    return `${responseTime}ms`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="database-manager">
      <div className="section-header">
        <h3><i className="fa-solid fa-database"></i> Database Manager</h3>
        <div className="refresh-controls">
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (10s)
          </label>
          <button onClick={loadDatabaseStatus} disabled={loading}>
            <i className="fa-solid fa-refresh"></i> Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {/* Current Database Status */}
      {healthStatus && (
        <div className="current-database">
          <h4>🎯 Current Active Database: <strong>{healthStatus.current?.toUpperCase() || 'Unknown'}</strong></h4>
        </div>
      )}

      {/* Database Status Cards */}
      {connections && (
        <div className="database-cards">
          {Object.entries(connections.databases).map(([dbName, dbInfo]) => (
            <div key={dbName} className={`database-card ${connections.current === dbName ? 'active' : ''}`}>
              <div className="card-header">
                <h4>
                  {getStatusIcon(dbInfo.status)} 
                  {dbName.toUpperCase()} Database
                  {connections.current === dbName && <span className="active-badge">ACTIVE</span>}
                </h4>
              </div>

              <div className="card-body">
                {/* Connection Status */}
                <div className="status-row">
                  <span className="label">Status:</span>
                  <span className={`status ${dbInfo.status}`}>{dbInfo.status}</span>
                </div>

                {/* Configuration */}
                {dbInfo.config && (
                  <div className="config-section">
                    <strong>Configuration:</strong>
                    <div className="config-details">
                      <div>Host: {dbInfo.config.host}</div>
                      <div>Port: {dbInfo.config.port}</div>
                      <div>Database: {dbInfo.config.database}</div>
                      <div>User: {dbInfo.config.user}</div>
                      <div>SSL: {dbInfo.config.ssl ? 'Enabled' : 'Disabled'}</div>
                    </div>
                  </div>
                )}

                {/* Pool Statistics */}
                {dbInfo.poolStats && (
                  <div className="pool-stats">
                    <strong>Connection Pool:</strong>
                    <div className="stats-grid">
                      <div>Total: {dbInfo.poolStats.total}</div>
                      <div>Idle: {dbInfo.poolStats.idle}</div>
                      <div>Waiting: {dbInfo.poolStats.waiting}</div>
                    </div>
                  </div>
                )}

                {/* Health Information */}
                <div className="health-info">
                  <div className="status-row">
                    <span className="label">Response Time:</span>
                    <span>{formatResponseTime(dbInfo.responseTime)}</span>
                  </div>
                  <div className="status-row">
                    <span className="label">Last Check:</span>
                    <span>{formatTimestamp(dbInfo.timestamp)}</span>
                  </div>
                  {dbInfo.error && (
                    <div className="error-message">
                      <strong>Error:</strong> {dbInfo.error}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="card-actions">
                  {dbInfo.available && (
                    <>
                      <button
                        onClick={() => testConnection(dbName)}
                        disabled={testResults[dbName]?.testing}
                        className="test-btn"
                      >
                        {testResults[dbName]?.testing ? (
                          <><i className="fa-solid fa-spinner fa-spin"></i> Testing...</>
                        ) : (
                          <><i className="fa-solid fa-stethoscope"></i> Test Connection</>
                        )}
                      </button>

                      {connections.current !== dbName && (
                        <button
                          onClick={() => switchDatabase(dbName)}
                          disabled={loading}
                          className="switch-btn"
                        >
                          {loading ? (
                            <><i className="fa-solid fa-spinner fa-spin"></i> Switching...</>
                          ) : (
                            <><i className="fa-solid fa-exchange-alt"></i> Switch to {dbName.toUpperCase()}</>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Test Results */}
                {testResults[dbName] && !testResults[dbName].testing && (
                  <div className={`test-results ${testResults[dbName].success ? 'success' : 'error'}`}>
                    <strong>Test Results:</strong>
                    {testResults[dbName].success ? (
                      <div className="test-success">
                        <div>✅ Connection successful!</div>
                        <div>Response time: {testResults[dbName].data.responseTime}ms</div>
                        <div>Database: {testResults[dbName].data.connection.current_database}</div>
                        <div>User: {testResults[dbName].data.connection.current_user}</div>
                      </div>
                    ) : (
                      <div className="test-error">
                        ❌ {testResults[dbName].error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading State */}
      {!connections && !message && (
        <div className="loading-state">
          <i className="fa-solid fa-spinner fa-spin"></i> Loading database status...
        </div>
      )}
    </div>
  );
};

export default DatabaseManager;