import express from "express";
import { requireAdminAuth } from "../controllers/admin.js";
import { 
  createBackup, 
  restoreBackup, 
  exportTable, 
  listBackups, 
  deleteBackup,
  getDatabaseInfo 
} from "../controllers/database.js";

const router = express.Router();

// All database operations require admin authentication
router.use(requireAdminAuth);

// Database info and status
router.get("/info", getDatabaseInfo);

// Backup operations
router.post("/backup", createBackup);
router.get("/backups", listBackups);
router.delete("/backups/:filename", deleteBackup);

// Export specific tables
router.post("/export/:table", exportTable);

// Restore operations
router.post("/restore", restoreBackup);

export default router;