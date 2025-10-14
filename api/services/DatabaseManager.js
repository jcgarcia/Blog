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
   * Initialize the database manager with both RDS and container configurations
   */
  async initialize() {
    if (this.initialized) return;

    console.log('🔧 Initializing DatabaseManager...');

    // Initialize RDS connection
    await this.initializeRDSConnection();
    
    // Initialize Container PostgreSQL connection
    await this.initializeContainerConnection();

    // Start health monitoring
    this.startHealthMonitoring();

    this.initialized = true;
    console.log('✅ DatabaseManager initialized successfully');
  }

  /**
   * Initialize AWS RDS connection using existing environment variables
   */
  async initializeRDSConnection() {
    const rdsRequiredVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
    const missingRds = rdsRequiredVars.filter(v => !process.env[v]);
    
    if (missingRds.length > 0) {
      console.warn(`⚠️  RDS connection unavailable - missing: ${missingRds.join(', ')}`);
      this.healthChecks.rds = { status: 'unavailable', error: 'Missing environment variables' };
      return;
    }

    try {
      this.pools.rds = new Pool({
        host: process.env.PGHOST,
        port: parseInt(process.env.PGPORT) || 5432,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
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
      const client = await this.pools.rds.connect();
      await client.query('SELECT 1');
      client.release();

      this.pools.rds.on('error', (err) => {
        console.error('RDS pool error:', err);
        this.healthChecks.rds = { status: 'error', error: err.message, timestamp: new Date() };
      });

      console.log('🟢 RDS connection initialized');
      this.healthChecks.rds = { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      console.error('❌ Failed to initialize RDS connection:', error.message);
      this.healthChecks.rds = { status: 'error', error: error.message, timestamp: new Date() };
    }
  }

  /**
   * Initialize Container PostgreSQL connection
   */
  async initializeContainerConnection() {
    const containerRequiredVars = ['POSTGRES_CONTAINER_HOST', 'POSTGRES_CONTAINER_USER', 'POSTGRES_CONTAINER_PASSWORD', 'POSTGRES_CONTAINER_DB'];
    const missingContainer = containerRequiredVars.filter(v => !process.env[v]);
    
    if (missingContainer.length > 0) {
      console.warn(`⚠️  Container PostgreSQL unavailable - missing: ${missingContainer.join(', ')}`);
      this.healthChecks.container = { status: 'unavailable', error: 'Missing environment variables' };
      return;
    }

    try {
      this.pools.container = new Pool({
        host: process.env.POSTGRES_CONTAINER_HOST,
        port: parseInt(process.env.POSTGRES_CONTAINER_PORT) || 5432,
        user: process.env.POSTGRES_CONTAINER_USER,
        password: process.env.POSTGRES_CONTAINER_PASSWORD,
        database: process.env.POSTGRES_CONTAINER_DB,
        ssl: false, // Container typically doesn't use SSL
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
      const client = await this.pools.container.connect();
      await client.query('SELECT 1');
      client.release();

      this.pools.container.on('error', (err) => {
        console.error('Container PostgreSQL pool error:', err);
        this.healthChecks.container = { status: 'error', error: err.message, timestamp: new Date() };
      });

      console.log('🟢 Container PostgreSQL connection initialized');
      this.healthChecks.container = { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      console.error('❌ Failed to initialize Container PostgreSQL connection:', error.message);
      this.healthChecks.container = { status: 'error', error: error.message, timestamp: new Date() };
    }
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
   * Switch to a different database
   * @param {string} database - 'rds' or 'container'
   */
  async switchDatabase(database) {
    if (!['rds', 'container'].includes(database)) {
      throw new Error('Invalid database. Must be "rds" or "container"');
    }

    if (!this.pools[database]) {
      throw new Error(`Database ${database} is not available`);
    }

    // Test connection before switching
    try {
      const client = await this.pools[database].connect();
      await client.query('SELECT 1');
      client.release();
    } catch (error) {
      throw new Error(`Cannot switch to ${database}: ${error.message}`);
    }

    const oldDatabase = this.currentDatabase;
    this.currentDatabase = database;

    console.log(`🔄 Switched database from ${oldDatabase} to ${database}`);
    return {
      success: true,
      oldDatabase,
      newDatabase: database,
      timestamp: new Date()
    };
  }

  /**
   * Get health status for all databases
   */
  getHealthStatus() {
    return {
      current: this.currentDatabase,
      databases: {
        rds: {
          ...this.healthChecks.rds,
          available: !!this.pools.rds,
          poolStats: this.pools.rds ? {
            total: this.pools.rds.totalCount,
            idle: this.pools.rds.idleCount,
            waiting: this.pools.rds.waitingCount
          } : null
        },
        container: {
          ...this.healthChecks.container,
          available: !!this.pools.container,
          poolStats: this.pools.container ? {
            total: this.pools.container.totalCount,
            idle: this.pools.container.idleCount,
            waiting: this.pools.container.waitingCount
          } : null
        }
      }
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