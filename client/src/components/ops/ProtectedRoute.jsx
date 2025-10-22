import React from 'react';
import { Link } from 'react-router-dom';
import { useDatabaseConnection } from '../contexts/DatabaseConnectionContext';

/**
 * Loading Spinner Component
 */
const LoadingSpinner = () => (
  <div className="loading-container">
    <div className="spinner"></div>
    <p>Checking database connection...</p>
  </div>
);

/**
 * Database Connection Required Component
 * Shown when user tries to access database-dependent features without connection
 */
const DatabaseConnectionRequired = ({ panelTitle = "This feature" }) => (
  <div className="database-connection-required">
    <div className="alert alert-warning">
      <h2>🔌 Database Connection Required</h2>
      <p>
        <strong>{panelTitle}</strong> requires an active database connection to function properly.
      </p>
      <p>
        Please configure and activate a database connection to access this feature.
      </p>
      
      <div className="connection-actions">
        <Link to="/ops/database" className="btn btn-primary">
          🔧 Configure Database Connection
        </Link>
      </div>
      
      <div className="help-text">
        <h3>What you can do:</h3>
        <ol>
          <li>Go to Database Management</li>
          <li>Add a new database connection</li>
          <li>Test and activate the connection</li>
          <li>Return to access all features</li>
        </ol>
      </div>
    </div>
  </div>
);

/**
 * Protected Route Component
 * Wraps routes that require database connections
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The component to render if access is allowed
 * @param {boolean} props.requiresDatabase - Whether this route requires database connection
 * @param {string} props.panelTitle - Title of the panel for error messages
 */
const ProtectedRoute = ({ 
  children, 
  requiresDatabase = false, 
  panelTitle = "This feature" 
}) => {
  const { 
    hasActiveConnection, 
    connectionLoading, 
    connectionError 
  } = useDatabaseConnection();
  
  // Show loading while checking connection status
  if (connectionLoading) {
    return <LoadingSpinner />;
  }
  
  // If route doesn't require database, always allow access
  if (!requiresDatabase) {
    return children;
  }
  
  // If route requires database but no connection exists, show requirement message
  if (requiresDatabase && !hasActiveConnection) {
    return <DatabaseConnectionRequired panelTitle={panelTitle} />;
  }
  
  // Connection exists or not required, render the protected component
  return children;
};

export default ProtectedRoute;