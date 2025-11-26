import express from 'express';
import { trackView, getViewCount } from '../controllers/views.js';

const router = express.Router();

// Track a view for a post (POST request to prevent accidental tracking from prefetch/crawlers)
router.post('/:postId/track', trackView);

// Get view count for a post (GET request for reading data)
router.get('/:postId', getViewCount);

export default router;