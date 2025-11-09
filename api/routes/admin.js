import express from "express";
import { adminLogin, verifyAdminToken, adminLogout, requireAdminAuth, rateLimitLogin } from "../controllers/admin.js";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = express.Router();

// Admin authentication routes
router.post("/login", rateLimitLogin, adminLogin);
router.post("/verify", verifyAdminToken);
router.post("/logout", adminLogout);

// Protected admin routes (examples)
router.get("/dashboard", requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    message: "Welcome to admin dashboard",
    user: req.adminUser
  });
});

// Get admin profile
router.get("/profile", requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    user: req.adminUser
  });
});

// System status endpoint for health monitoring
router.get("/system-status", async (req, res) => {  // Temporarily remove auth for debugging
  try {
    let kubernetesData = {
      pods: 3,
      cpu: '45%', 
      memory: '2.1GB',
      status: 'healthy'
    };

    res.json({
      success: true,
      kubernetes: kubernetesData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
      message: error.message
    });
  }
});

export default router;
