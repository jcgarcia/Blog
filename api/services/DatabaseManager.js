import pkg from 'pg';
const { Pool } = pkg;

/**
 * DatabaseManager - Handles switching between AWS RDS and Container PostgreSQL
 * 
 * Supports two database configurations:
 * - AWS RDS (primary): Uses existing PGHOST environment variables
 * - Container PostgreSQL (secondary): Uses POSTGRES_CONTAINER_* environment variables
 * 
 * Features:
 * - Health monitoring for both databases
 * - Automatic failover capabilities
 * - Connection pooling for both instances
 * - Manual switching via admin panel
 */
class DatabaseManager {
  constructor() {
    this.pools = {};
    this.currentDatabase = 'rds'; // Default to RDS
    this.healthChecks = {};
    this.initialized = false;
  }

  /**
   * Initialize the database manager using CoreDB-stored configurations
   */
  async initialize() {
    if (this.initialized) return;

    console.log('🔧 Initializing DatabaseManager with CoreDB configurations...');

    // Initialize connections from CoreDB
    await this.initializeFromCoreDB();

    // Start health monitoring
    this.startHealthMonitoring();

    this.initialized = true;
    console.log('✅ DatabaseManager initialized successfully');
  }

  /**
   * Initialize database connections from CoreDB configurations
   */
  async initializeFromCoreDB() {
    try {
      // Import CoreDB dynamically to avoid circular dependencies
      const { default: CoreDB } = await import('./CoreDB.js');
      const coreDB = CoreDB.getInstance();
      
      // Get all database connections from CoreDB
      const connections = await coreDB.getDatabaseConnections();
      
      if (connections.length === 0) {
        console.warn('⚠️  No database connections found in CoreDB');
        console.warn('   Database connections must be configured through the ops panel');
        return;
      }
      
      console.log(`🔧 Found ${connections.length} database connections in CoreDB`);
      
      // Initialize each connection
      for (const conn of connections) {
        await this.initializeConnection(conn);
      }
      
      // Set the active database from CoreDB
      const activeConfig = await coreDB.getActiveDatabaseConfig();
      if (activeConfig) {
        // Find the corresponding pool key for the active connection
        const poolKey = this.getPoolKeyForConnection(activeConfig);
        if (poolKey && this.pools[poolKey]) {
          this.currentDatabase = poolKey;
          console.log(`✅ Active database set to: ${activeConfig.name} (${poolKey})`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize from CoreDB:', error.message);
    }
  }

  /**
   * Initialize a single database connection from CoreDB configuration
   */
  async initializeConnection(config) {
    const poolKey = this.getPoolKeyForConnection(config);
    
    try {
      console.log(`🔧 Initializing connection: ${config.name} (${config.host}:${config.port})`);
      
      this.pools[poolKey] = new Pool({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        ssl: config.ssl_mode === 'require' ? { rejectUnauthorized: false } : false,
        max: 10,
        min: 1,
        idle: 5000,
        acquire: 30000,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
        allowExitOnIdle: true,
        statement_timeout: 30000,
        query_timeout: 25000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 0
      });

      // Test connection
      const client = await this.pools[poolKey].connect();
      await client.query('SELECT 1');
      client.release();

      this.pools[poolKey].on('error', (err) => {
        console.error(`${config.name} pool error:`, err);
        this.healthChecks[poolKey] = { status: 'error', error: err.message, timestamp: new Date() };
      });

      console.log(`✅ ${config.name} connection initialized successfully`);
      this.healthChecks[poolKey] = { status: 'healthy', timestamp: new Date() };
      
    } catch (error) {
      console.error(`❌ Failed to initialize ${config.name}:`, error.message);
      this.healthChecks[poolKey] = { status: 'error', error: error.message, timestamp: new Date() };
    }
  }

  /**
   * Generate a pool key for a database connection configuration
   */
  getPoolKeyForConnection(config) {
    // Generate a unique key based on connection properties
    return `${config.type}_${config.host}_${config.port}_${config.database}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Get the currently active database pool
   */
  getCurrentPool() {
    if (!this.initialized) {
      throw new Error('DatabaseManager not initialized. Call initialize() first.');
    }

    const pool = this.pools[this.currentDatabase];
    if (!pool) {
      throw new Error(`No pool available for current database: ${this.currentDatabase}`);
    }

    return pool;
  }

  /**
   * Switch to a different database connection by ID (CoreDB-centric)
   * @param {number} connectionId - Database connection ID from CoreDB
   */
  async switchDatabase(connectionId) {
    try {
      // Import CoreDB dynamically to avoid circular dependencies
      const { default: CoreDB } = await import('./CoreDB.js');
      const coreDB = CoreDB.getInstance();
      
      // Get the connection configuration from CoreDB
      const connections = await coreDB.getDatabaseConnections();
      const targetConnection = connections.find(conn => conn.id === connectionId);
      
      if (!targetConnection) {
        throw new Error(`Database connection with ID ${connectionId} not found`);
      }
      
      const poolKey = this.getPoolKeyForConnection(targetConnection);
      
      if (!this.pools[poolKey]) {
        throw new Error(`Database connection "${targetConnection.name}" is not available`);
      }

      // Test connection before switching
      try {
        const client = await this.pools[poolKey].connect();
        await client.query('SELECT 1');
        client.release();
      } catch (error) {
        throw new Error(`Cannot switch to "${targetConnection.name}": ${error.message}`);
      }

      const oldDatabase = this.currentDatabase;
      this.currentDatabase = poolKey;
      
      // Update active connection in CoreDB
      await coreDB.setActiveDatabaseConnection(connectionId);

      console.log(`🔄 Switched database from ${oldDatabase} to ${targetConnection.name}`);
      return {
        success: true,
        oldDatabase,
        newDatabase: targetConnection.name,
        connectionId,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to switch database: ${error.message}`);
    }
  }

  /**
   * Get health status for all databases (CoreDB-centric)
   */
  getHealthStatus() {
    const databases = {};
    
    // Build status for each configured pool
    for (const [poolKey, pool] of Object.entries(this.pools)) {
      databases[poolKey] = {
        ...this.healthChecks[poolKey],
        available: !!pool,
        poolStats: pool ? {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount
        } : null
      };
    }
    
    return {
      current: this.currentDatabase,
      databases
    };
  }

  /**
   * Start periodic health monitoring
   */
  startHealthMonitoring() {
    setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Check every 30 seconds

    console.log('🔍 Health monitoring started');
  }

  /**
   * Perform health checks on all available databases
   */
  async performHealthChecks() {
    for (const [dbName, pool] of Object.entries(this.pools)) {
      if (!pool) continue;

      try {
        const start = Date.now();
        const client = await pool.connect();
        await client.query('SELECT 1');
        const responseTime = Date.now() - start;
        client.release();

        this.healthChecks[dbName] = {
          status: 'healthy',
          responseTime,
          timestamp: new Date()
        };
      } catch (error) {
        this.healthChecks[dbName] = {
          status: 'error',
          error: error.message,
          timestamp: new Date()
        };
      }
    }
  }

  /**
   * Execute a query on the current database
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   */
  async query(text, params) {
    const pool = this.getCurrentPool();
    return await pool.query(text, params);
  }

  /**
   * Get a client connection from the current database pool
   */
  async getClient() {
    const pool = this.getCurrentPool();
    return await pool.connect();
  }

  /**
   * Graceful shutdown - close all connections
   */
  async shutdown() {
    console.log('🔧 Shutting down DatabaseManager...');

    for (const [dbName, pool] of Object.entries(this.pools)) {
      if (pool) {
        console.log(`Closing ${dbName} connection pool...`);
        await pool.end();
      }
    }

    this.pools = {};
    this.initialized = false;
    console.log('✅ DatabaseManager shutdown complete');
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

// Graceful shutdown handlers
const gracefulShutdown = async () => {
  console.log('Received shutdown signal, closing database pools...');
  await databaseManager.shutdown();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // For nodemon restarts

export default databaseManager;

// For backwards compatibility, export pool-like interface
export function getDbPool() {
  return databaseManager.getCurrentPool();
}

export async function closeDbPool() {
  await databaseManager.shutdown();
}