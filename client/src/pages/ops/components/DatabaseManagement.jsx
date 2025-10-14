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

  useEffect(() => {
    fetchDatabaseInfo();
    fetchBackups();
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

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Backup created successfully: ${data.backup.filename}`);
        fetchBackups(); // Refresh the list
      } else {
        setError(data.message || 'Failed to create backup');
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