import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * Database Connection Context
 * Manages the state of database connectivity across the ops panel
 * Determines which panels should be available based on database connection status
 */
const DatabaseConnectionContext = createContext({
  hasActiveConnection: false,
  activeConnection: null,
  connectionLoading: true,
  connectionError: null,
  refreshConnection: () => {}
});

/**
 * Database Connection Provider Component
 * Polls the backend for database connection status and provides state to child components
 */
export const DatabaseConnectionProvider = ({ children }) => {
  const [hasActiveConnection, setHasActiveConnection] = useState(false);
  const [activeConnection, setActiveConnection] = useState(null);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  const checkConnectionStatus = async () => {
    try {
      setConnectionError(null);
      const response = await fetch('https://bapi.ingasti.com/api/database/connection-status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHasActiveConnection(data.connected || false);
        setActiveConnection(data.connected ? {
          name: data.connectionName,
          database: data.database,
          host: data.host,
          port: data.port
        } : null);
      } else {
        setHasActiveConnection(false);
        setActiveConnection(null);
        setConnectionError('Failed to check connection status');
      }
    } catch (error) {
      console.error('Error checking database connection status:', error);
      setHasActiveConnection(false);
      setActiveConnection(null);
      setConnectionError(error.message);
    } finally {
      setConnectionLoading(false);
    }
  };

  // Check connection status on mount and set up polling
  useEffect(() => {
    checkConnectionStatus();
    
    // Poll every 10 seconds for connection status
    const interval = setInterval(checkConnectionStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const value = {
    hasActiveConnection,
    activeConnection,
    connectionLoading,
    connectionError,
    refreshConnection: checkConnectionStatus
  };

  return (
    <DatabaseConnectionContext.Provider value={value}>
      {children}
    </DatabaseConnectionContext.Provider>
  );
};

/**
 * Hook to use database connection context
 */
export const useDatabaseConnection = () => {
  const context = useContext(DatabaseConnectionContext);
  if (context === undefined) {
    throw new Error('useDatabaseConnection must be used within a DatabaseConnectionProvider');
  }
  return context;
};

export default DatabaseConnectionContext;