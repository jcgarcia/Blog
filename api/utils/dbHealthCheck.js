import { getDbPool } from '../db.js';

/**
 * Database Health Check Utility
 * Monitors connection pool health and provides diagnostics
 */

export async function checkDatabaseHealth() {
  const pool = getDbPool();
  
  // Check if this is the mock pool (DataDB not configured yet)
  if (pool.totalCount === 0 && typeof pool.query === 'function') {
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      if (error.message.includes('No database connection configured')) {
        return {
          status: 'pending_configuration',
          message: 'DataDB not configured yet - this is expected on first startup',
          note: 'Configure DataDB connection through the ops panel after admin login',
          timestamp: new Date().toISOString()
        };
      }
    }
  }
  
  try {
    const startTime = Date.now();
    
    // Test basic connectivity
    const result = await pool.query('SELECT NOW() as server_time, version() as pg_version');
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Get pool statistics
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
    
    // Get database connection info
    const connectionInfo = await pool.query(`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    
    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      serverTime: result.rows[0].server_time,
      postgresVersion: result.rows[0].pg_version,
      poolStats,
      databaseConnections: connectionInfo.rows[0],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

export async function getDetailedConnectionInfo() {
  const pool = getDbPool();
  
  try {
    // Get detailed connection information
    const result = await pool.query(`
      SELECT 
        pid,
        usename,
        application_name,
        client_addr,
        client_port,
        backend_start,
        state,
        state_change,
        query_start,
        LEFT(query, 100) as current_query
      FROM pg_stat_activity 
      WHERE datname = current_database()
      ORDER BY backend_start DESC
    `);
    
    return {
      success: true,
      connections: result.rows,
      total: result.rows.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export async function terminateIdleConnections(maxIdleMinutes = 30) {
  const pool = getDbPool();
  
  try {
    // Find connections that have been idle for more than maxIdleMinutes
    const idleConnections = await pool.query(`
      SELECT pid, state, state_change, usename, application_name
      FROM pg_stat_activity 
      WHERE datname = current_database()
        AND state = 'idle'
        AND state_change < NOW() - INTERVAL '${maxIdleMinutes} minutes'
        AND pid != pg_backend_pid()
    `);
    
    if (idleConnections.rows.length === 0) {
      return {
        success: true,
        message: 'No idle connections to terminate',
        terminated: 0
      };
    }
    
    // Terminate idle connections
    let terminated = 0;
    for (const conn of idleConnections.rows) {
      try {
        await pool.query('SELECT pg_terminate_backend($1)', [conn.pid]);
        terminated++;
      } catch (termError) {
        console.warn(`Failed to terminate connection ${conn.pid}:`, termError.message);
      }
    }
    
    return {
      success: true,
      message: `Terminated ${terminated} idle connections`,
      terminated,
      total: idleConnections.rows.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Express middleware for health check endpoint
export function createHealthCheckEndpoint() {
  return async (req, res) => {
    try {
      const health = await checkDatabaseHealth();
      let status;
      if (health.status === 'healthy') {
        status = 200;
      } else if (health.status === 'pending_configuration') {
        status = 200; // DataDB not configured is OK - not an error
      } else {
        status = 503;
      }
      res.status(status).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };
}

// Express middleware for detailed connection info
export function createConnectionInfoEndpoint() {
  return async (req, res) => {
    try {
      const info = await getDetailedConnectionInfo();
      res.json(info);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
}
