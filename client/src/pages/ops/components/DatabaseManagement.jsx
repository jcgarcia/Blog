import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../../../config/api.js';
import './DatabaseManagement.css';

const DatabaseManagement = () => {
  const [databaseInfo, setDatabaseInfo] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmRestore, setConfirmRestore] = useState('');
  
  // Database configuration state
  const [connections, setConnections] = useState([]);
  const [activeConnection, setActiveConnection] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [switchingDatabase, setSwitchingDatabase] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'postgresql',
    host: '',
    port: '5432',
    database: '',
    username: '',
    password: '',
    ssl_mode: 'require'
  });

  useEffect(() => {
    fetchDatabaseInfo();
    fetchBackups();
    fetchDatabaseConnections();
  }, []);

  const fetchDatabaseInfo = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.DATABASE.INFO, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setDatabaseInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch database info:', error);
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.DATABASE.BACKUPS, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    }
  };

  const createBackup = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(API_ENDPOINTS.DATABASE.BACKUP, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Get the filename from the Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        const filename = filenameMatch ? filenameMatch[1] : `backup-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.sql`;
        
        // Create blob from response and trigger download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setSuccess(`Database backup downloaded successfully: ${filename}`);
        fetchBackups(); // Refresh the list (though it will be empty now)
      } else {
        // For non-200 responses, try to parse as JSON for error message
        try {
          const data = await response.json();
          setError(data.message || 'Failed to create backup');
        } catch {
          setError(`Failed to create backup (HTTP ${response.status})`);
        }
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const deleteBackup = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete backup: ${filename}?`)) {
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.DATABASE.DELETE_BACKUP(filename), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Backup deleted: ${filename}`);
        fetchBackups(); // Refresh the list
      } else {
        setError(data.message || 'Failed to delete backup');
      }
    } catch (error) {
      setError('Network error occurred');
    }
  };

  const exportTable = async (tableName) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(API_ENDPOINTS.DATABASE.EXPORT_TABLE(tableName), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          includeSchema: true
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Table ${tableName} exported successfully: ${data.export.filename}`);
        fetchBackups(); // Refresh the list
      } else {
        setError(data.message || 'Failed to export table');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async (filename) => {
    if (confirmRestore !== 'RESTORE') {
      setError('Please type RESTORE in the confirmation field');
      return;
    }

    if (!window.confirm(`WARNING: This will overwrite ALL database data with the backup from ${filename}. This action cannot be undone. Are you absolutely sure?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(API_ENDPOINTS.DATABASE.RESTORE, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename,
          confirmRestore: true
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setConfirmRestore('');
        fetchDatabaseInfo(); // Refresh database info
      } else {
        setError(data.message || 'Failed to restore backup');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Database configuration functions
  const fetchDatabaseConnections = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.DATABASE.CONNECTIONS, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
        setActiveConnection(data.active || null);
      }
    } catch (error) {
      console.error('Failed to fetch database connections:', error);
    }
  };

  const testDatabaseConnection = async (databaseType) => {
    try {
      setTestResults(prev => ({ ...prev, [databaseType]: 'testing' }));
      
      const response = await fetch(`${API_ENDPOINTS.DATABASE.TEST}/${databaseType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });
      
      const data = await response.json();
      setTestResults(prev => ({ 
        ...prev, 
        [databaseType]: response.ok ? 'success' : 'failed' 
      }));
      
      if (!response.ok) {
        setError(`Database test failed: ${data.message}`);
      }
    } catch (error) {
      setTestResults(prev => ({ ...prev, [databaseType]: 'failed' }));
      setError('Network error during database test');
    }
  };

  const switchDatabase = async (databaseType) => {
    if (!window.confirm(`Are you sure you want to switch to ${databaseType}? This will affect all blog operations.`)) {
      return;
    }

    setSwitchingDatabase(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(API_ENDPOINTS.DATABASE.SWITCH, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ database: databaseType }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Successfully switched to ${databaseType} database`);
        setActiveConnection(databaseType);
        fetchDatabaseInfo(); // Refresh database info
        fetchDatabaseConnections(); // Refresh connections
      } else {
        setError(data.message || 'Failed to switch database');
      }
    } catch (error) {
      setError('Network error occurred during database switch');
    } finally {
      setSwitchingDatabase(false);
    }
  };

  // Database connection form functions
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddConnection = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch(API_ENDPOINTS.DATABASE.CREATE_CONNECTION, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Database connection created successfully');
        setShowAddForm(false);
        setFormData({
          name: '',
          type: 'postgresql',
          host: '',
          port: '5432',
          database: '',
          username: '',
          password: '',
          ssl_mode: 'require'
        });
        fetchDatabaseConnections(); // Refresh connections list
      } else {
        setError(data.message || 'Failed to create database connection');
      }
    } catch (error) {
      setError('Network error occurred while creating connection');
    }
  };

  const handleDeleteConnection = async (connectionId, connectionName) => {
    if (!window.confirm(`Are you sure you want to delete the connection "${connectionName}"?`)) {
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.DATABASE.DELETE_CONNECTION(connectionId), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Database connection deleted successfully');
        fetchDatabaseConnections(); // Refresh connections list
      } else {
        setError(data.message || 'Failed to delete database connection');
      }
    } catch (error) {
      setError('Network error occurred while deleting connection');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="database-management">
      <h2>Database Management</h2>
      
      {/* Status Messages */}
      {error && (
        <div className="alert alert-error mb-4">
          <span className="text-red-600">{error}</span>
        </div>
      )}
      
      {success && (
        <div className="alert alert-success mb-4">
          <span className="text-green-600">{success}</span>
        </div>
      )}

      {/* Database Information */}
      {databaseInfo && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-3">Database Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Database:</strong> {databaseInfo.database?.database_name}
            </div>
            <div>
              <strong>Size:</strong> {databaseInfo.database?.database_size}
            </div>
            <div>
              <strong>User:</strong> {databaseInfo.database?.current_user}
            </div>
            <div>
              <strong>PostgreSQL:</strong> {databaseInfo.database?.postgres_version?.split(' ')[1]}
            </div>
          </div>

          {/* Tables Information */}
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Tables</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left">Table</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Size</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {databaseInfo.tables?.map((table) => (
                    <tr key={table.tablename}>
                      <td className="border border-gray-300 px-3 py-2">{table.tablename}</td>
                      <td className="border border-gray-300 px-3 py-2">{table.size}</td>
                      <td className="border border-gray-300 px-3 py-2">
                        <button
                          onClick={() => exportTable(table.tablename)}
                          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                          disabled={loading}
                        >
                          Export
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Database Configuration */}
      <div className="bg-white p-4 rounded-lg border mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Database Configuration</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            {showAddForm ? 'Cancel' : 'Add New Connection'}
          </button>
        </div>

        {/* Add Connection Form */}
        {showAddForm && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h4 className="font-semibold mb-3">Add New Database Connection</h4>
            <form onSubmit={handleAddConnection} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Connection Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="PostgreSQL Production"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Database Type</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Host</label>
                  <input
                    type="text"
                    name="host"
                    value={formData.host}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="dbdb.ingasti.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Port</label>
                  <input
                    type="number"
                    name="port"
                    value={formData.port}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5432"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Database Name</label>
                  <input
                    type="text"
                    name="database"
                    value={formData.database}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="blog"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="dbcore_usr_2025"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">SSL Mode</label>
                  <select
                    name="ssl_mode"
                    value={formData.ssl_mode}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="require">Require</option>
                    <option value="prefer">Prefer</option>
                    <option value="allow">Allow</option>
                    <option value="disable">Disable</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Create Connection
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
        
        {connections.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Available Database Connections</h4>
            <div className="space-y-3">
              {connections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{connection.name}</span>
                      {activeConnection === connection.name && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      <div>Type: {connection.type}</div>
                      <div>Host: {connection.host}:{connection.port}</div>
                      <div>Database: {connection.database}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Test Connection */}
                    <button
                      onClick={() => testDatabaseConnection(connection.type)}
                      className={`px-3 py-1 rounded text-sm ${
                        testResults[connection.type] === 'success' 
                          ? 'bg-green-100 text-green-800' 
                          : testResults[connection.type] === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : testResults[connection.type] === 'testing'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                      disabled={testResults[connection.type] === 'testing'}
                    >
                      {testResults[connection.type] === 'testing' ? 'Testing...' : 
                       testResults[connection.type] === 'success' ? '✓ Connected' :
                       testResults[connection.type] === 'failed' ? '✗ Failed' : 'Test'}
                    </button>
                    
                    {/* Switch Database */}
                    {activeConnection !== connection.name && (
                      <button
                        onClick={() => switchDatabase(connection.name)}
                        className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                        disabled={switchingDatabase}
                      >
                        {switchingDatabase ? 'Switching...' : 'Switch'}
                      </button>
                    )}
                    
                    {/* Delete Connection */}
                    <button
                      onClick={() => handleDeleteConnection(connection.id, connection.name)}
                      className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {connections.length === 0 && !showAddForm && (
          <div className="text-gray-600 text-center py-4">
            No database connections configured. Click "Add New Connection" to get started.
          </div>
        )}
      </div>

      {/* Backup Operations */}
      <div className="bg-white p-4 rounded-lg border mb-6">
        <h3 className="text-lg font-semibold mb-3">Backup Operations</h3>
        
        <div className="mb-4">
          <button
            onClick={createBackup}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Creating Backup...' : 'Create Full Backup'}
          </button>
        </div>

        {/* Existing Backups */}
        <div>
          <h4 className="font-semibold mb-2">Available Backups ({backups.length})</h4>
          {backups.length === 0 ? (
            <p className="text-gray-500">No backups available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left">Filename</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Size</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Created</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => (
                    <tr key={backup.filename}>
                      <td className="border border-gray-300 px-3 py-2 font-mono text-sm">
                        {backup.filename}
                      </td>
                      <td className="border border-gray-300 px-3 py-2">{backup.size}</td>
                      <td className="border border-gray-300 px-3 py-2">
                        {formatDate(backup.created)}
                      </td>
                      <td className="border border-gray-300 px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => deleteBackup(backup.filename)}
                            className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Restore Operations */}
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <h3 className="text-lg font-semibold mb-3 text-red-800">⚠️ Restore Operations</h3>
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded">
          <p className="text-red-800 font-semibold">
            WARNING: Restore operations will completely overwrite the current database!
          </p>
          <p className="text-red-700">
            This action cannot be undone. Make sure you have a current backup before proceeding.
          </p>
        </div>

        <div className="mb-4">
          <label className="block mb-2">
            Type "RESTORE" to enable restore operations:
            <input
              type="text"
              value={confirmRestore}
              onChange={(e) => setConfirmRestore(e.target.value)}
              className="block w-full mt-1 px-3 py-2 border border-gray-300 rounded"
              placeholder="Type RESTORE"
            />
          </label>
        </div>

        {backups.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Select Backup to Restore</h4>
            <div className="space-y-2">
              {backups.map((backup) => (
                <div key={backup.filename} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-mono text-sm">{backup.filename}</div>
                    <div className="text-xs text-gray-600">
                      {backup.size} • {formatDate(backup.created)}
                    </div>
                  </div>
                  <button
                    onClick={() => restoreBackup(backup.filename)}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                    disabled={loading || confirmRestore !== 'RESTORE'}
                  >
                    {loading ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseManagement;