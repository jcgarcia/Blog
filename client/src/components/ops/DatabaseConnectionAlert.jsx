import React from 'react';
import { Link } from 'react-router-dom';
import { useDatabaseConnection } from '../../contexts/DatabaseConnectionContext';

/**
 * Database Connection Alert Component
 * Shows status and guidance about database connectivity in the ops panel
 */
const DatabaseConnectionAlert = () => {
  const { 
    hasActiveConnection, 
    activeConnection, 
    connectionLoading, 
    connectionError,
    refreshConnection 
  } = useDatabaseConnection();

  if (connectionLoading) {
    return (
      <div className="connection-alert loading">
        <div className="spinner-small"></div>
        <span>Checking connection...</span>
      </div>
    );
  }

  if (hasActiveConnection && activeConnection) {
    return (
      <div className="connection-alert success">
        <span className="status-icon">✅</span>
        <div className="connection-info">
          <strong>Connected</strong>
          <small>{activeConnection.name}</small>
        </div>
        <button 
          onClick={refreshConnection}
          className="btn-refresh"
          title="Refresh connection status"
        >
          🔄
        </button>
      </div>
    );
  }

  return (
    <div className="connection-alert warning">
      <div className="alert-content">
        <span className="status-icon">⚠️</span>
        <div className="alert-text">
          <strong>No Database Connection</strong>
          <p>Some features are limited without a database connection.</p>
        </div>
      </div>
      
      <div className="alert-actions">
        <Link to="/ops/database" className="btn btn-primary btn-sm">
          Configure Database
        </Link>
        <button 
          onClick={refreshConnection}
          className="btn btn-secondary btn-sm"
        >
          Retry
        </button>
      </div>
      
      {connectionError && (
        <div className="error-details">
          <small>Error: {connectionError}</small>
        </div>
      )}
    </div>
  );
};

export default DatabaseConnectionAlert;