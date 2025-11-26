import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbPool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database migration runner
 * Executes SQL migration files in order during application startup
 */
export class DatabaseMigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
    this.db = getDbPool();
  }

  /**
   * Create migrations tracking table if it doesn't exist
   */
  async createMigrationsTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    try {
      await this.db.query(createTableQuery);
      console.log('✅ Migrations table ready');
    } catch (error) {
      console.error('❌ Failed to create migrations table:', error);
      throw error;
    }
  }

  /**
   * Get list of already executed migrations
   */
  async getExecutedMigrations() {
    try {
      const result = await this.db.query('SELECT filename FROM migrations ORDER BY filename');
      return result.rows.map(row => row.filename);
    } catch (error) {
      console.error('❌ Failed to get executed migrations:', error);
      return [];
    }
  }

  /**
   * Get list of migration files from filesystem
   */
  getMigrationFiles() {
    try {
      if (!fs.existsSync(this.migrationsDir)) {
        console.log('📁 No migrations directory found, creating...');
        fs.mkdirSync(this.migrationsDir, { recursive: true });
        return [];
      }

      const files = fs.readdirSync(this.migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Execute in alphabetical order

      return files;
    } catch (error) {
      console.error('❌ Failed to read migrations directory:', error);
      return [];
    }
  }

  /**
   * Execute a single migration file
   */
  async executeMigration(filename) {
    const filePath = path.join(this.migrationsDir, filename);
    
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`🔄 Executing migration: ${filename}`);
      
      // Execute the migration
      await this.db.query(sql);
      
      // Record the migration as executed
      await this.db.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );
      
      console.log(`✅ Migration completed: ${filename}`);
    } catch (error) {
      console.error(`❌ Migration failed: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    try {
      console.log('🔄 Starting database migrations...');
      
      // Ensure migrations table exists
      await this.createMigrationsTable();
      
      // Get executed and available migrations
      const executedMigrations = await this.getExecutedMigrations();
      const availableMigrations = this.getMigrationFiles();
      
      // Find pending migrations
      const pendingMigrations = availableMigrations.filter(
        migration => !executedMigrations.includes(migration)
      );

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations');
        return;
      }

      console.log(`📋 Found ${pendingMigrations.length} pending migrations:`, pendingMigrations);

      // Execute each pending migration
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      console.log('✅ All migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration process failed:', error);
      throw error;
    }
  }
}

/**
 * Initialize and run database migrations
 * Called during application startup
 */
export async function initializeDatabaseMigrations() {
  const migrationRunner = new DatabaseMigrationRunner();
  await migrationRunner.runMigrations();
}