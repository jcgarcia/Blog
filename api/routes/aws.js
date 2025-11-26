import express from 'express';
import awsSsoRefreshService from '../services/awsSsoRefreshService.js';
import oidcCredentialRefreshService from '../services/oidcCredentialRefreshService.js';

const router = express.Router();

/**
 * POST /api/aws/refresh-credentials
 * Manually trigger credential refresh
 */
router.post('/refresh-credentials', async (req, res) => {
  try {
    console.log('🔄 Manual AWS SSO credential refresh requested');
    const result = await awsSsoRefreshService.manualRefresh();
    
    res.json({
      success: true,
      message: result.message,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    console.error('Manual credential refresh failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/aws/credential-status
 * Get current AWS credential status
 */
router.get('/credential-status', async (req, res) => {
  try {
    const status = await awsSsoRefreshService.getCredentialStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Failed to check credential status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/aws/auto-refresh
 * Auto-refresh endpoint (can be called by cron or manually)
 */
router.post('/auto-refresh', async (req, res) => {
  try {
    const status = await awsSsoRefreshService.getCredentialStatus();
    
    if (status.status === 'expired' || status.status === 'expiring_soon') {
      const result = await awsSsoRefreshService.manualRefresh();
      res.json({
        success: true,
        refreshed: true,
        message: 'Credentials refreshed successfully',
        expiresAt: result.expiresAt
      });
    } else {
      res.json({
        success: true,
        refreshed: false,
        message: 'No refresh needed - credentials still valid',
        timeRemaining: status.timeRemaining
      });
    }
  } catch (error) {
    console.error('Auto-refresh failed:', error);
    res.status(500).json({
      success: false,
      refreshed: false,
      error: error.message
    });
  }
});

/**
 * POST /api/aws/start-monitoring
 * Start automatic credential refresh monitoring
 */
router.post('/start-monitoring', async (req, res) => {
  try {
    await awsSsoRefreshService.startAutoRefresh();
    res.json({
      success: true,
      message: 'AWS SSO auto-refresh monitoring started successfully'
    });
  } catch (error) {
    console.error('Error starting auto-refresh:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start auto-refresh monitoring',
      error: error.message
    });
  }
});

/**
 * POST /api/aws/stop-monitoring
 * Stop automatic credential refresh monitoring
 */
router.post('/stop-monitoring', (req, res) => {
  try {
    awsSsoRefreshService.stopAutoRefresh();
    res.json({
      success: true,
      message: 'AWS SSO auto-refresh monitoring stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping auto-refresh:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop auto-refresh monitoring',
      error: error.message
    });
  }
});


/**
 * GET /api/aws/oidc-status
 * Get OIDC credential refresh service status
 */
router.get('/oidc-status', async (req, res) => {
  try {
    const status = oidcCredentialRefreshService.getStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Failed to get OIDC status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/aws/oidc-refresh
 * Manually trigger OIDC credential refresh
 */
router.post('/oidc-refresh', async (req, res) => {
  try {
    console.log('🔄 Manual OIDC credential refresh requested');
    await oidcCredentialRefreshService.refreshCredentials();
    res.json({
      success: true,
      message: 'OIDC credentials refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Manual OIDC refresh failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


export default router;
