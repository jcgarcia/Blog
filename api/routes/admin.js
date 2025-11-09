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
router.get("/system-status", requireAdminAuth, async (req, res) => {
  try {
    let kubernetesData = {
      pods: 0,
      cpu: '0%',
      memory: '0MB',
      status: 'unknown'
    };

    try {
      // Check if kubectl is available
      const { stdout: kubectlCheck } = await execAsync('which kubectl', { timeout: 5000 });
      
      if (kubectlCheck.trim()) {
        // Get pod information
        const { stdout: podStatus } = await execAsync(
          'kubectl get pods --no-headers | wc -l', 
          { timeout: 10000 }
        );
        kubernetesData.pods = parseInt(podStatus.trim()) || 0;
        
        try {
          // Get resource usage - try to get pod metrics
          const { stdout: resourceUsage } = await execAsync(
            'kubectl top nodes --no-headers 2>/dev/null | head -1', 
            { timeout: 10000 }
          );
          
          if (resourceUsage.trim()) {
            const parts = resourceUsage.trim().split(/\s+/);
            if (parts.length >= 3) {
              kubernetesData.cpu = parts[2] || '0%';
              kubernetesData.memory = parts[4] || '0MB';
            }
          }
        } catch (metricsError) {
          console.warn('Metrics server not available, using fallback values');
        }
        
        kubernetesData.status = 'healthy';
      }
    } catch (kubectlError) {
      console.warn('Kubectl not available or not configured:', kubectlError.message);
      kubernetesData.status = 'not_available';
    }

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
