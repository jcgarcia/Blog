import express from "express";
import {
  getOAuthSettings,
  updateOAuthSettings,
  getAwsExternalId,
  saveAwsExternalId,
  getAwsConfig,
  updateAwsConfig,
  getMediaStorageConfig
} from "../controllers/settings.js";

// Import CoreDB-based settings controllers
import {
  getSettings,
  getAllSettings,
  updateSettings,
  getSocialMediaLinks,
  updateSocialMediaLinks
} from "../controllers/coredbSettings.js";
import { requireAdminAuth } from "../controllers/admin.js";

const router = express.Router();

// Get all public settings
router.get("/", getSettings);

// Get all settings including admin-only ones (admin only)
router.get("/admin", requireAdminAuth, getAllSettings);

// Update settings (admin only)
router.put("/", requireAdminAuth, updateSettings);

// Get social media links
router.get("/social", getSocialMediaLinks);

// Update social media links (admin only)
router.put("/social", updateSocialMediaLinks);
router.post("/social", updateSocialMediaLinks);

// Get OAuth configuration (admin only)
router.get("/oauth", requireAdminAuth, getOAuthSettings);

// Update OAuth configuration (admin only) 
router.put("/oauth", requireAdminAuth, updateOAuthSettings);

// AWS External ID management (admin only)
router.get("/aws-external-id", requireAdminAuth, getAwsExternalId);
router.post("/aws-external-id", requireAdminAuth, saveAwsExternalId);

// AWS Configuration management (admin only)
router.get("/aws-config", requireAdminAuth, getAwsConfig);
router.put("/aws-config", requireAdminAuth, updateAwsConfig);

// Media Storage Configuration (admin only)
router.get("/media-storage", requireAdminAuth, getMediaStorageConfig);

export default router;
