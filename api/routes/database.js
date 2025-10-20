import express from "express";
import { requireAdminAuth } from "../controllers/admin.js";
import { 
  createBackup, 
  restoreBackup, 
  exportTable, 
  listBackups, 
  deleteBackup,
  downloadBackup,
  getDatabaseInfo,
  getDatabaseHealthStatus,
  switchDatabase,
  getDatabaseConnections,
  testDatabaseConnection,
  createDatabaseConnection,
  updateDatabaseConnection,
  deleteDatabaseConnection
} from "../controllers/database.js";

const router = express.Router();

// All database operations require admin authentication
router.use(requireAdminAuth);

// Database info and status
router.get("/info", getDatabaseInfo);

// Multi-database management
router.get("/health", getDatabaseHealthStatus);
router.get("/connections", getDatabaseConnections);
router.post("/connections", createDatabaseConnection);
router.put("/connections/:id", updateDatabaseConnection);
router.delete("/connections/:id", deleteDatabaseConnection);
router.post("/switch", switchDatabase);
router.get("/test/:database", testDatabaseConnection);

// Backup operations
router.post("/backup", createBackup);
router.get("/backups", listBackups);
router.delete("/backups/:filename", deleteBackup);
router.get("/backups/:filename/download", downloadBackup);

// Export specific tables
router.post("/export/:table", exportTable);

// Restore operations
router.post("/restore", restoreBackup);

export default router;