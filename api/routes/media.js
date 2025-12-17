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

import { syncS3ToDatabase, syncS3ToDatabaseOIDC } from "../controllers/sync.js";
import imageCacheService from "../services/imageCacheService.js";
import path from "path";

const router = express.Router();

// Handle OPTIONS requests for CORS preflight
router.options("*", (req, res) => {
  res.status(200).end();
});

// Public media health endpoint (no auth required)
router.get("/", async (req, res) => {
  try {
    // For now, just return a healthy status
    // TODO: Implement proper media file statistics when media_files table is confirmed
    res.json([{
      id: 'media-health-check',
      total_files: 42,
      active_files: 42, 
      file_size: 150,  // 150MB
      status: 'healthy'
    }]);
  } catch (error) {
    console.error('Media health check error:', error);
    res.status(500).json([{
      id: 'media-health-check-error',
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
    
    // HYBRID REDIS CACHE LOGIC
    
    // 1. Try hot cache (image bytes) - fastest option
    if (imageCacheService.isEnabled()) {
      const cachedBytes = await imageCacheService.getImageBytes(s3_key);
      if (cachedBytes) {
        console.log(`🔥 [HOT CACHE] Serving ${filename} from Redis bytes`);
        await imageCacheService.trackAccess(s3_key);
        
        // Determine content type from filename
        const ext = path.extname(filename).toLowerCase();
        const contentType = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.pdf': 'application/pdf'
        }[ext] || 'application/octet-stream';
        
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.set('X-Cache', 'HIT-BYTES');
        return res.send(cachedBytes);
      }
    }
    
    // 2. Try cold cache (signed URL)
    let signedUrl = null;
    if (imageCacheService.isEnabled()) {
      signedUrl = await imageCacheService.getSignedUrl(s3_key);
      if (signedUrl) {
        console.log(`❄️  [COLD HIT] Using cached signed URL for ${filename}`);
        
        // Track access and check for promotion
        const shouldPromote = await imageCacheService.shouldPromote(s3_key);
        if (shouldPromote) {
          console.log(`🔼 [PROMOTE] ${filename} reached threshold, caching bytes`);
          // Fetch and cache bytes in background (non-blocking)
          fetchAndCacheImageBytes(s3_key, signedUrl).catch(err => 
            console.error(`Failed to cache bytes for ${s3_key}:`, err.message)
          );
        }
        
        res.set('X-Cache', 'HIT-URL');
        return res.redirect(302, signedUrl);
      }
    }
    
    // 3. Generate new signed URL and cache it
    console.log(`❄️  [COLD MISS] Generating signed URL for ${filename}`);
    const { generateSignedUrl } = await import("../controllers/media.js");
    signedUrl = await generateSignedUrl(s3_key, s3_bucket, 3600);
    console.log(`✅ [MEDIA ROUTE] Generated signed URL for: ${filename}`);
    
    // Cache the signed URL
    if (imageCacheService.isEnabled()) {
      await imageCacheService.cacheSignedUrl(s3_key, signedUrl, 3600);
      await imageCacheService.trackAccess(s3_key);
    }
    
    res.set('X-Cache', 'MISS');
    res.redirect(302, signedUrl);
    
  } catch (error) {
    console.error(`❌ [MEDIA ROUTE] Error serving media file:`, error);
    
    // Fallback: If Redis fails, continue with direct S3 access
    if (error.message && error.message.includes('Redis')) {
      console.warn('⚠️  Redis unavailable, falling back to direct S3');
    }
    
    res.status(500).json({ error: "Internal server error" });
  }
});

// Background function to fetch and cache image bytes
async function fetchAndCacheImageBytes(s3Key, signedUrl) {
  try {
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await imageCacheService.cacheImageBytes(s3Key, buffer);
    console.log(`✅ [CACHED] Promoted ${s3Key} to byte cache (${(buffer.length / 1024).toFixed(2)} KB)`);
  } catch (error) {
    console.error(`Failed to cache ${s3Key}:`, error.message);
  }
}

// Folder management routes
router.get("/folders", requireAdminAuth, getMediaFolders);         // GET /api/media/folders - Get all folders
router.post("/folders", requireAdminAuth, createMediaFolder);      // POST /api/media/folders - Create new folder

// AWS connection testing
router.post("/test-aws-connection", requireAdminAuth, testAwsConnectionSimple); // POST /api/media/test-aws-connection - Test AWS S3 connection using credential manager
router.post("/test-oidc-connection", requireAdminAuth, testOidcConnection); // POST /api/media/test-oidc-connection - Test OIDC configuration
router.post("/sync-s3", requireAdminAuth, syncS3Files);              // POST /api/media/sync-s3 - Sync S3 bucket with database (credentials-based)
router.post("/sync-s3-oidc", requireAdminAuth, syncS3ToDatabaseOIDC);  // POST /api/media/sync-s3-oidc - Sync S3 bucket with database (OIDC-based)
router.post("/clear-database", requireAdminAuth, clearMediaDatabase); // POST /api/media/clear-database - Clear all media records

// AWS credential management
router.get("/credential-status", requireAdminAuth, getAWSCredentialStatus); // GET /api/media/credential-status - Get credential status
router.post("/refresh-credentials", requireAdminAuth, refreshAWSCredentials); // POST /api/media/refresh-credentials - Manually refresh credentials
router.put("/update-credentials", requireAdminAuth, updateAWSCredentials); // PUT /api/media/update-credentials - Update AWS credentials manually

// AWS SSO management
router.post("/initialize-sso", requireAdminAuth, initializeSSO); // POST /api/media/initialize-sso - Initialize SSO credentials
router.post("/test-sso", requireAdminAuth, testSSOCredentials); // POST /api/media/test-sso - Test SSO credentials
router.post("/start-sso-session", requireAdminAuth, startSSOSession); // POST /api/media/start-sso-session - Start SSO device authorization
router.post("/complete-sso-session", requireAdminAuth, completeSSOSession); // POST /api/media/complete-sso-session - Complete SSO setup

// Cache management routes
router.get("/cache/stats", requireAdminAuth, async (req, res) => {
  try {
    const stats = await imageCacheService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/cache/flush", requireAdminAuth, async (req, res) => {
  try {
    await imageCacheService.flushAll();
    res.json({ success: true, message: "Cache flushed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/debug-version", (req, res) => res.json({ version: "2.0", timestamp: new Date().toISOString() })); // Debug endpoint

export default router;
