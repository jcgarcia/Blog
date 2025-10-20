import { exec } from 'child_process';
import { promisify } from 'util';
import { getDbPool, databaseManager } from '../db.js';
import CoreDB from '../services/CoreDB.js';

const execAsync = promisify(exec);

// Database connection details from environment (use the same config as the app)
const DB_CONFIG = {
  host: process.env.DB_HOST || process.env.PGHOST,
  port: process.env.DB_PORT || process.env.PGPORT || 5432,
  database: process.env.DB_NAME || process.env.PGDATABASE,
  username: process.env.DB_USER || process.env.PGUSER,
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD
};

// Get database information and status
export const getDatabaseInfo = async (req, res) => {
  try {
    const pool = getDbPool();
    
    // Get database size and table information
    const sizeQuery = `
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        current_database() as database_name,
        current_user as current_user,
        version() as postgres_version
    `;
    
    const tablesQuery = `
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_stat_get_tuples_returned(c.oid) as row_count
      FROM pg_tables pt
      JOIN pg_class c ON c.relname = pt.tablename
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;
    
    const [sizeResult, tablesResult] = await Promise.all([
      pool.query(sizeQuery),
      pool.query(tablesQuery)
    ]);
    
    res.json({
      success: true,
      database: sizeResult.rows[0],
      tables: tablesResult.rows
    });
  } catch (error) {
    console.error('Database info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database information',
      error: error.message
    });
  }
};

// Create and download database backup (stream directly to user)
export const createBackup = async (req, res) => {
  try {
    console.log('🔧 Database config check:', {
      host: DB_CONFIG.host ? 'SET' : 'MISSING',
      port: DB_CONFIG.port,
      database: DB_CONFIG.database ? 'SET' : 'MISSING',
      username: DB_CONFIG.username ? 'SET' : 'MISSING',
      password: DB_CONFIG.password ? 'SET' : 'MISSING'
    });

    // Validate database config
    if (!DB_CONFIG.host || !DB_CONFIG.database || !DB_CONFIG.username || !DB_CONFIG.password) {
      throw new Error('Missing required database configuration parameters');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${DB_CONFIG.database}-${timestamp}.sql`;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Build pg_dump command that outputs to stdout
    const cmd = `PGPASSWORD="${DB_CONFIG.password}" pg_dump -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.username} -d ${DB_CONFIG.database} --no-password`;
    
    console.log('Streaming database backup:', filename);
    
    // Execute command and stream output directly to response
    const { spawn } = await import('child_process');
    const pgDump = spawn('pg_dump', [
      '-h', DB_CONFIG.host,
      '-p', DB_CONFIG.port.toString(),
      '-U', DB_CONFIG.username,
      '-d', DB_CONFIG.database,
      '--no-password'
    ], {
      env: { ...process.env, PGPASSWORD: DB_CONFIG.password }
    });

    // Stream stdout directly to response
    pgDump.stdout.pipe(res);
    
    // Handle errors
    pgDump.stderr.on('data', (data) => {
      console.error('pg_dump stderr:', data.toString());
    });

    pgDump.on('error', (error) => {
      console.error('pg_dump process error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Failed to create backup',
          error: error.message
        });
      }
    });

    pgDump.on('close', (code) => {
      if (code !== 0) {
        console.error(`pg_dump process exited with code ${code}`);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: `Backup process failed with exit code ${code}`
          });
        }
      } else {
        console.log('✅ Database backup streamed successfully');
      }
    });

  } catch (error) {
    console.error('Backup creation error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to create backup',
        error: error.message
      });
    }
  }
};

// List all available backups
export const listBackups = async (req, res) => {
  try {
    // Since we now stream backups directly to users, we don't store them
    // This endpoint returns empty but maintains API compatibility
    res.json({
      success: true,
      backups: [],
      count: 0,
      message: 'Backups are now generated on-demand and streamed directly to download'
    });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list backups',
      error: error.message
    });
  }
};

// Delete a specific backup file
export const deleteBackup = async (req, res) => {
  try {
    // Since we don't store backups anymore, this operation is not applicable
    res.status(404).json({
      success: false,
      message: 'Delete operation not available - backups are now streamed directly and not stored'
    });
  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete backup',
      error: error.message
    });
  }
};

// Export specific table (stream directly to user)
export const exportTable = async (req, res) => {
  try {
    const { table } = req.params;
    const { includeSchema = true } = req.body;
    
    // Validate table name (security)
    const pool = getDbPool();
    const tableCheck = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = $1",
      [table]
    );
    
    if (tableCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Table not found'
      });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `export-${table}-${timestamp}.sql`;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    console.log(`Streaming table export: ${table}`);
    
    // Build pg_dump arguments for table export
    const pgDumpArgs = [
      '-h', DB_CONFIG.host,
      '-p', DB_CONFIG.port.toString(),
      '-U', DB_CONFIG.username,
      '-d', DB_CONFIG.database,
      '--no-password',
      '-t', table
    ];
    
    if (!includeSchema) {
      pgDumpArgs.push('--data-only');
    }
    
    // Execute command and stream output directly to response
    const { spawn } = await import('child_process');
    const pgDump = spawn('pg_dump', pgDumpArgs, {
      env: { ...process.env, PGPASSWORD: DB_CONFIG.password }
    });

    // Stream stdout directly to response
    pgDump.stdout.pipe(res);
    
    // Handle errors
    pgDump.stderr.on('data', (data) => {
      console.error('pg_dump stderr:', data.toString());
    });

    pgDump.on('error', (error) => {
      console.error('pg_dump process error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Failed to export table',
          error: error.message
        });
      }
    });

    pgDump.on('close', (code) => {
      if (code !== 0) {
        console.error(`pg_dump process exited with code ${code}`);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: `Export process failed with exit code ${code}`
          });
        }
      } else {
        console.log(`✅ Table ${table} export streamed successfully`);
      }
    });
  } catch (error) {
    console.error('Table export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export table',
      error: error.message
    });
  }
};

// Download backup file (no longer applicable since backups are streamed directly)
export const downloadBackup = async (req, res) => {
  try {
    res.status(404).json({
      success: false,
      message: 'Download not available - backups are now generated and streamed directly via /api/database/backup'
    });
  } catch (error) {
    console.error('Download backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download backup',
      error: error.message
    });
  }
};

// Restore database from uploaded backup file
export const restoreBackup = async (req, res) => {
  try {
    const { confirmRestore } = req.body;
    
    // Safety check
    if (!confirmRestore) {
      return res.status(400).json({
        success: false,
        message: 'Restore confirmation required'
      });
    }
    
    // Check if file was uploaded (using multer middleware)
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No backup file uploaded'
      });
    }
    
    // Validate file type
    if (!req.file.originalname.endsWith('.sql')) {
      return res.status(400).json({
        success: false,
        message: 'Only .sql files are allowed'
      });
    }
    
    console.log('RESTORING DATABASE FROM UPLOADED FILE:', req.file.originalname);
    console.log('WARNING: This will overwrite existing data');
    
    // Stream the uploaded file directly to psql
    const { spawn } = await import('child_process');
    const psql = spawn('psql', [
      '-h', DB_CONFIG.host,
      '-p', DB_CONFIG.port.toString(),
      '-U', DB_CONFIG.username,
      '-d', DB_CONFIG.database
    ], {
      env: { ...process.env, PGPASSWORD: DB_CONFIG.password },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Stream the file buffer to psql stdin
    psql.stdin.write(req.file.buffer);
    psql.stdin.end();

    // Handle process completion
    psql.on('close', (code) => {
      if (code === 0) {
        res.json({
          success: true,
          message: 'Database restored successfully',
          warning: 'Database has been restored. All previous data has been overwritten.'
        });
      } else {
        res.status(500).json({
          success: false,
          message: `Restore process failed with exit code ${code}`
        });
      }
    });

    psql.on('error', (error) => {
      console.error('psql process error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restore database',
        error: error.message
      });
    });

  } catch (error) {
    console.error('Database restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore database',
      error: error.message
    });
  }
};

// Database Manager Functions for Multi-Database Support

/**
 * Get health status for all available databases
 */
export const getDatabaseHealthStatus = async (req, res) => {
  try {
    const healthStatus = databaseManager.getHealthStatus();
    
    res.json({
      success: true,
      ...healthStatus
    });
  } catch (error) {
    console.error('Error getting database health status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database health status',
      error: error.message
    });
  }
};

/**
 * Switch to a different database
 */
export const switchDatabase = async (req, res) => {
  try {
    const { database } = req.body;

    if (!database) {
      return res.status(400).json({
        success: false,
        message: 'Database parameter is required'
      });
    }

    if (!['rds', 'container'].includes(database)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid database. Must be "rds" or "container"'
      });
    }

    const result = await databaseManager.switchDatabase(database);
    
    console.log(`📊 Database switched by admin user: ${req.user?.username || 'unknown'}`);
    
    res.json({
      success: true,
      message: `Successfully switched to ${database} database`,
      ...result
    });
  } catch (error) {
    console.error('Error switching database:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to switch database',
      error: error.message
    });
  }
};

/**
 * Get detailed database connection information
 */
export const getDatabaseConnections = async (req, res) => {
  try {
    const coreDB = CoreDB.getInstance();
    
    // Get database connections from CoreDB
    const connections = await coreDB.getDatabaseConnections();
    const activeDatabase = await coreDB.getActiveDatabaseConfig();
    
    res.json({
      success: true,
      connections: connections,
      active: activeDatabase?.name || null
    });
  } catch (error) {
    console.error('Error getting database connections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database connections',
      error: error.message,
      connections: []
    });
  }
};

/**
 * Test connection to a specific database configuration
 */
export const testDatabaseConnection = async (req, res) => {
  try {
    const { database } = req.params;
    const coreDB = CoreDB.getInstance();
    
    // Get the database connection with encrypted password
    const connection = await coreDB.db.get(`
      SELECT id, name, type, host, port, database_name as database, 
             username, password_encrypted, ssl_mode, active
      FROM external_databases 
      WHERE id = ? OR name = ? OR type = ?
    `, [database, database, database]);

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: `Database connection "${database}" not found`
      });
    }

    // Get decrypted password
    const decryptedPassword = coreDB.decrypt(connection.password_encrypted);

    // Create a temporary connection pool for testing
    const { Pool } = await import('pg');
    const testPool = new Pool({
      host: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password: decryptedPassword,
      ssl: connection.ssl_mode === 'disable' ? false : { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
    });

    try {
      // Test connection with a simple query
      const start = Date.now();
      const client = await testPool.connect();
      const result = await client.query('SELECT current_database(), current_user, version(), now() as timestamp');
      const responseTime = Date.now() - start;
      client.release();

      await testPool.end();

      res.json({
        success: true,
        database: connection.name,
        responseTime,
        connection: result.rows[0]
      });
    } catch (testError) {
      await testPool.end();
      throw testError;
    }
  } catch (error) {
    console.error(`Error testing database connection:`, error);
    res.status(500).json({
      success: false,
      message: `Failed to test database connection: ${error.message}`,
      error: error.message
    });
  }
};
/**
 * Create a new database connection configuration
 */
export const createDatabaseConnection = async (req, res) => {
  try {
    const { name, type, host, port, database, username, password, ssl_mode } = req.body;
    
    // Validate required fields
    if (!name || !type || !host || !port || !database || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'All database connection fields are required'
      });
    }

    const coreDB = CoreDB.getInstance();
    const connectionId = await coreDB.createDatabaseConnection({
      name,
      type,
      host,
      port: parseInt(port),
      database,
      username,
      password,
      ssl_mode: ssl_mode || 'require'
    });

    res.json({
      success: true,
      message: 'Database connection created successfully',
      id: connectionId
    });
  } catch (error) {
    console.error('Error creating database connection:', error);
    res.status(500).json({
      success: false,
      message: error.message.includes('UNIQUE constraint failed') 
        ? 'A database connection with this name already exists'
        : 'Failed to create database connection',
      error: error.message
    });
  }
};

/**
 * Update an existing database connection configuration
 */
export const updateDatabaseConnection = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, host, port, database, username, password, ssl_mode } = req.body;
    
    const coreDB = CoreDB.getInstance();
    const updateData = {};
    
    if (name) updateData.name = name;
    if (type) updateData.type = type;
    if (host) updateData.host = host;
    if (port) updateData.port = parseInt(port);
    if (database) updateData.database = database;
    if (username) updateData.username = username;
    if (password) updateData.password = password;
    if (ssl_mode) updateData.ssl_mode = ssl_mode;

    await coreDB.updateDatabaseConnection(id, updateData);

    res.json({
      success: true,
      message: 'Database connection updated successfully'
    });
  } catch (error) {
    console.error('Error updating database connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update database connection',
      error: error.message
    });
  }
};

/**
 * Delete a database connection configuration
 */
export const deleteDatabaseConnection = async (req, res) => {
  try {
    const { id } = req.params;
    
    const coreDB = CoreDB.getInstance();
    await coreDB.deleteDatabaseConnection(id);

    res.json({
      success: true,
      message: 'Database connection deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting database connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete database connection',
      error: error.message
    });
  }
};
