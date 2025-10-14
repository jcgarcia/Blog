import databaseManager from './services/DatabaseManager.js';

// ---
// Database Configuration:
// 
// AWS RDS (Primary):
// db-host      → PGHOST
// db-port      → PGPORT  
// db-user      → PGUSER
// db-key       → PGPASSWORD
// db-name      → PGDATABASE
//
// Container PostgreSQL (Secondary):
// postgres-container-host     → POSTGRES_CONTAINER_HOST
// postgres-container-port     → POSTGRES_CONTAINER_PORT
// postgres-container-user     → POSTGRES_CONTAINER_USER  
// postgres-container-password → POSTGRES_CONTAINER_PASSWORD
// postgres-container-db       → POSTGRES_CONTAINER_DB
// ---

import pkg from 'pg';
const { Pool } = pkg;

// Fallback pool for backward compatibility
let fallbackPool = null;

// Initialize database manager on first import
let initPromise = null;
let isInitialized = false;

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = databaseManager.initialize().then(() => {
      isInitialized = true;
      // Close fallback pool if it exists since we now have DatabaseManager
      if (fallbackPool) {
        fallbackPool.end().catch(console.error);
        fallbackPool = null;
      }
    });
  }
  await initPromise;
}

// Create a fallback pool for backward compatibility during startup
function createFallbackPool() {
  if (fallbackPool) {
    return fallbackPool;
  }
  
  // Check for required environment variables
  const requiredVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required DB environment variables: ${missing.join(', ')}`);
  }

  console.log('🔄 Creating fallback database pool during initialization...');
  
  fallbackPool = new Pool({
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

  return fallbackPool;
}

// Backwards compatible interface - can be used sync after initialization
export function getDbPool() {
  if (isInitialized) {
    try {
      return databaseManager.getCurrentPool();
    } catch (error) {
      console.warn('DatabaseManager failed, falling back to basic pool:', error.message);
      return createFallbackPool();
    }
  }
  
  // If not initialized, return fallback pool for backward compatibility
  console.warn('DatabaseManager not yet initialized, using fallback pool');
  return createFallbackPool();
}

// Async version for explicit async usage
export async function getDbPoolAsync() {
  await ensureInitialized();
  return databaseManager.getCurrentPool();
}

export async function closeDbPool() {
  await databaseManager.shutdown();
}

// Export database manager for advanced usage
export { databaseManager };