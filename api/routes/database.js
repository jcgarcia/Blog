import express from "express";
import multer from "multer";
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

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    // Accept .sql files only
    if (file.mimetype === 'application/sql' || file.originalname.endsWith('.sql')) {
      cb(null, true);
    } else {
      cb(new Error('Only .sql files are allowed'), false);
    }
  }
});

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
router.get("/connections/:id/test", testDatabaseConnection);
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
router.post("/restore", requireAdminAuth, upload.single('backup'), restoreBackup);

export default router;