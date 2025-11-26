import express from 'express';
import { getDashboardAnalytics, getPostAnalytics } from '../controllers/analytics.js';
import { requireAdminAuth } from '../controllers/admin.js';

const router = express.Router();

// Dashboard analytics (admin only)
router.get('/dashboard', requireAdminAuth, getDashboardAnalytics);

// Detailed post analytics (admin only)  
router.get('/posts', requireAdminAuth, getPostAnalytics);

export default router;