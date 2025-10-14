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

// Initialize database manager on first import
let initPromise = null;
async function ensureInitialized() {
  if (!initPromise) {
    initPromise = databaseManager.initialize();
  }
  await initPromise;
}

// Backwards compatible interface
export async function getDbPool() {
  await ensureInitialized();
  return databaseManager.getCurrentPool();
}

export async function closeDbPool() {
  await databaseManager.shutdown();
}

// Export database manager for advanced usage
export { databaseManager };