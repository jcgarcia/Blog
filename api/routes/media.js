import express from "express";
import { requireAdminAuth } from "../controllers/admin.js";
import {
  uploadToS3,
  getMediaFiles,
  getMediaFile,
  updateMediaFile,
  deleteMediaFile,
  getTrashFiles,
  restoreMediaFile,
  emptyTrash,
  moveMediaFile,
  getMediaFolders,
  createMediaFolder,
  testAwsConnection,
  testAwsConnectionSimple,
  testOidcConnection,
  syncS3Files,
  clearMediaDatabase,
  getAWSCredentialStatus,
  refreshAWSCredentials,
  updateAWSCredentials,
  initializeSSO,
  testSSOCredentials,
  startSSOSession,
  completeSSOSession,
  getSignedUrlForKey
} from "../controllers/media.js";

import { fixMediaSchema } from "../controllers/databaseFix.js";

import { syncS3ToDatabase, syncS3ToDatabaseOIDC } from "../controllers/sync.js";

const router = express.Router();

// Handle OPTIONS requests for CORS preflight
router.options("*", (req, res) => {
  res.status(200).end();
});

// Public media health endpoint (no auth required)
router.get("/", async (req, res) => {
  try {
    const { getDbPool } = await import("../db.js");
    const pool = getDbPool();
    
    // Get basic media statistics without exposing sensitive data
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_files,
        COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_files,
        COALESCE(SUM(CASE WHEN deleted_at IS NULL THEN file_size ELSE 0 END), 0) as total_size
      FROM media_files
    `);
    
    const stats = result.rows[0];
    
    res.json([{
      id: 'health-check',
      total_files: parseInt(stats.total_files),
      active_files: parseInt(stats.active_files), 
      file_size: parseInt(stats.total_size),
      status: 'healthy'
    }]);
  } catch (error) {
    console.error('Media health check error:', error);
    res.status(500).json([{
      id: 'health-check-error',
      total_files: 0,
      active_files: 0,
      file_size: 0, 
      status: 'error',
      error: error.message
    }]);
  }
});

// Media file management routes
router.post("/upload", requireAdminAuth, uploadToS3);              // POST /api/media/upload - Upload file to S3
router.get("/files", requireAdminAuth, getMediaFiles);             // GET /api/media/files - Get all media files with pagination
router.get("/files/:id", requireAdminAuth, getMediaFile);          // GET /api/media/files/:id - Get single media file
router.put("/files/:id", requireAdminAuth, updateMediaFile);       // PUT /api/media/files/:id - Update media metadata
router.put("/files/:id/move", requireAdminAuth, moveMediaFile);    // PUT /api/media/files/:id/move - Move file to different folder
router.delete("/files/:id", requireAdminAuth, deleteMediaFile);    // DELETE /api/media/files/:id - Delete media file (soft delete to trash)
router.get("/signed-url", requireAdminAuth, getSignedUrlForKey);   // GET /api/media/signed-url?key=... - Get signed URL for S3 key

// Trash management routes
router.get("/trash", requireAdminAuth, getTrashFiles);             // GET /api/media/trash - Get all trashed files
router.post("/trash/:id/restore", requireAdminAuth, restoreMediaFile); // POST /api/media/trash/:id/restore - Restore file from trash
router.delete("/trash/empty", requireAdminAuth, emptyTrash);       // DELETE /api/media/trash/empty - Empty trash (permanent delete)

// Media serving route - serve files by filename or S3 key with signed URLs (must be after other routes)
router.get("/serve/*", async (req, res) => {
  try {
    // Extract the full path after /serve/
    const fullPath = req.params[0];
    console.log(`🎯 [MEDIA ROUTE] Request for path: ${fullPath}`);
    console.log(`🎯 [MEDIA ROUTE] Full URL: ${req.originalUrl}`);
    
    // Determine if it's a filename or S3 key path
    let filename;
    if (fullPath.includes('/')) {
      // It's an S3 key path like "uploads/images/2025-11-09/terra-l5-e9bb73c5.png"
      // Extract just the filename
      filename = fullPath.split('/').pop();
      console.log(`🔍 [MEDIA ROUTE] Extracted filename from S3 key: ${filename}`);
    } else {
      // It's already a filename
      filename = fullPath;
      console.log(`🔍 [MEDIA ROUTE] Direct filename: ${filename}`);
    }
    
    // Look up the file in the database
    const { getDbPool } = await import("../db.js");
    const pool = getDbPool();
    const result = await pool.query(
      "SELECT s3_key, s3_bucket FROM media WHERE filename = $1",
      [filename]
    );
    
    if (result.rows.length === 0) {
      console.log(`❌ [MEDIA ROUTE] File not found in database: ${filename}`);
      return res.status(404).json({ error: "File not found", filename: filename });
    }
    
    const { s3_key, s3_bucket } = result.rows[0];
    console.log(`🔍 [MEDIA ROUTE] Found file: ${s3_key} in bucket: ${s3_bucket}`);
    
    // Generate signed URL using OIDC credential manager
    console.log('🔑 [MEDIA ROUTE] Using OIDC credential manager for signed URL generation');
    const { generateSignedUrl } = await import("../controllers/media.js");
    
    // Use the OIDC-aware signed URL generator instead of manual S3Client creation
    console.log('🎯 [MEDIA ROUTE] About to call generateSignedUrl from media.js');
    const signedUrl = await generateSignedUrl(s3_key, 'bedtimeblog-medialibrary', 3600);
    console.log(`✅ [MEDIA ROUTE] Generated signed URL for: ${filename}`);
    
    // Redirect to the signed URL
    res.redirect(302, signedUrl);
    
  } catch (error) {
    console.error(`❌ [MEDIA ROUTE] Error serving media file ${req.params.filename}:`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Folder management routes
router.get("/folders", requireAdminAuth, getMediaFolders);         // GET /api/media/folders - Get all folders
router.post("/folders", requireAdminAuth, createMediaFolder);      // POST /api/media/folders - Create new folder

// AWS connection testing
router.post("/test-aws-connection", requireAdminAuth, testAwsConnectionSimple); // POST /api/media/test-aws-connection - Test AWS S3 connection using credential manager
router.post("/test-oidc-connection", requireAdminAuth, testOidcConnection); // POST /api/media/test-oidc-connection - Test OIDC configuration
router.post("/sync-s3", requireAdminAuth, syncS3Files);              // POST /api/media/sync-s3 - Sync S3 bucket with database (credentials-based)
router.post("/sync-s3-oidc", requireAdminAuth, syncS3ToDatabaseOIDC);  // POST /api/media/sync-s3-oidc - Sync S3 bucket with database (OIDC-based)
router.post("/clear-database", requireAdminAuth, clearMediaDatabase); // POST /api/media/clear-database - Clear all media records

// Database schema fix for migration issues
router.post("/fix-schema", requireAdminAuth, fixMediaSchema); // POST /api/media/fix-schema - Fix database schema after migration

// AWS credential management
router.get("/credential-status", requireAdminAuth, getAWSCredentialStatus); // GET /api/media/credential-status - Get credential status
router.post("/refresh-credentials", requireAdminAuth, refreshAWSCredentials); // POST /api/media/refresh-credentials - Manually refresh credentials
router.put("/update-credentials", requireAdminAuth, updateAWSCredentials); // PUT /api/media/update-credentials - Update AWS credentials manually

// AWS SSO management
router.post("/initialize-sso", requireAdminAuth, initializeSSO); // POST /api/media/initialize-sso - Initialize SSO credentials
router.post("/test-sso", requireAdminAuth, testSSOCredentials); // POST /api/media/test-sso - Test SSO credentials
router.post("/start-sso-session", requireAdminAuth, startSSOSession); // POST /api/media/start-sso-session - Start SSO device authorization
router.post("/complete-sso-session", requireAdminAuth, completeSSOSession); // POST /api/media/complete-sso-session - Complete SSO setup

router.get("/debug-version", (req, res) => res.json({ version: "2.0", timestamp: new Date().toISOString() })); // Debug endpoint

export default router;
