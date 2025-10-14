import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { getDbPool } from '../db.js';

const execAsync = promisify(exec);

// Directory for storing database backups (use activity folder in docs repo)
const BACKUP_DIR = process.env.BACKUP_DIR || '/home/jcgarcia/docs/Tech/Blog/activity/backups/database';

// Database connection details from environment (use the same config as the app)
const DB_CONFIG = {
  host: process.env.DB_HOST || process.env.PGHOST,
  port: process.env.DB_PORT || process.env.PGPORT || 5432,
  database: process.env.DB_NAME || process.env.PGDATABASE,
  username: process.env.DB_USER || process.env.PGUSER,
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD
};

// Ensure backup directory exists
async function ensureBackupDir() {
  try {
    await fs.access(BACKUP_DIR);
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  }
}

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

// Create a full database backup
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

    await ensureBackupDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);
    
    // Build pg_dump command
    const cmd = `PGPASSWORD="${DB_CONFIG.password}" pg_dump -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.username} -d ${DB_CONFIG.database} --no-password > ${filepath}`;
    
    console.log('Creating database backup:', filename);
    console.log('Backup directory:', BACKUP_DIR);
    
    await execAsync(cmd);
    
    // Get backup file size
    const stats = await fs.stat(filepath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    res.json({
      success: true,
      message: 'Backup created successfully',
      backup: {
        filename,
        size: `${sizeInMB} MB`,
        created: new Date().toISOString(),
        path: filepath
      }
    });
  } catch (error) {
    console.error('Backup creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create backup',
      error: error.message
    });
  }
};

// List all available backups
export const listBackups = async (req, res) => {
  try {
    console.log('📂 Listing backups from directory:', BACKUP_DIR);
    
    await ensureBackupDir();
    console.log('✅ Backup directory ensured');
    
    const files = await fs.readdir(BACKUP_DIR);
    console.log('📁 Files found:', files.length);
    
    const backups = [];
    
    for (const file of files) {
      if (file.endsWith('.sql')) {
        const filepath = path.join(BACKUP_DIR, file);
        try {
          const stats = await fs.stat(filepath);
          
          backups.push({
            filename: file,
            size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            created: stats.mtime.toISOString(),
            path: filepath
          });
        } catch (statError) {
          console.error(`Error reading file stats for ${file}:`, statError);
        }
      }
    }
    
    // Sort by creation date (newest first)
    backups.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    console.log('✅ Found', backups.length, 'backups');
    
    res.json({
      success: true,
      backups
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
    const { filename } = req.params;
    
    // Security check: only allow .sql files and no path traversal
    if (!filename.endsWith('.sql') || filename.includes('../') || filename.includes('..\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }
    
    const filepath = path.join(BACKUP_DIR, filename);
    await fs.unlink(filepath);
    
    res.json({
      success: true,
      message: 'Backup deleted successfully'
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

// Export specific table
export const exportTable = async (req, res) => {
  try {
    const { table } = req.params;
    const { format = 'sql', includeSchema = true } = req.body;
    
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
    
    await ensureBackupDir();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `export-${table}-${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);
    
    // Build export command
    let cmd;
    if (includeSchema) {
      cmd = `PGPASSWORD="${DB_CONFIG.password}" pg_dump -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.username} -d ${DB_CONFIG.database} --no-password -t ${table} > ${filepath}`;
    } else {
      cmd = `PGPASSWORD="${DB_CONFIG.password}" pg_dump -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.username} -d ${DB_CONFIG.database} --no-password -t ${table} --data-only > ${filepath}`;
    }
    
    console.log(`Exporting table ${table}:`, filename);
    await execAsync(cmd);
    
    // Get file size
    const stats = await fs.stat(filepath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    res.json({
      success: true,
      message: `Table ${table} exported successfully`,
      export: {
        filename,
        size: `${sizeInMB} MB`,
        created: new Date().toISOString(),
        path: filepath
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

// Restore database from backup
export const restoreBackup = async (req, res) => {
  try {
    const { filename, confirmRestore } = req.body;
    
    // Safety check
    if (!confirmRestore) {
      return res.status(400).json({
        success: false,
        message: 'Restore confirmation required'
      });
    }
    
    // Validate filename
    if (!filename.endsWith('.sql') || filename.includes('../') || filename.includes('..\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }
    
    const filepath = path.join(BACKUP_DIR, filename);
    
    // Check if file exists
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found'
      });
    }
    
    // WARNING: This will overwrite the existing database
    const cmd = `PGPASSWORD="${DB_CONFIG.password}" psql -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.username} -d ${DB_CONFIG.database} < ${filepath}`;
    
    console.log('RESTORING DATABASE FROM:', filename);
    console.log('WARNING: This will overwrite existing data');
    
    await execAsync(cmd);
    
    res.json({
      success: true,
      message: 'Database restored successfully',
      warning: 'Database has been restored. All previous data has been overwritten.'
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