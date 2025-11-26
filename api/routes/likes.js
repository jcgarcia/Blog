import express from 'express';
import { addLike, removeLike, getLikes, toggleLike } from '../controllers/likes.js';

const router = express.Router();

// Get likes for a post (includes user's like status if authenticated)
router.get('/:postId', getLikes);

// Toggle like on a post (preferred method)
router.post('/:postId/toggle', toggleLike);

// Legacy endpoints for backward compatibility
router.post('/:postId', addLike);
router.delete('/:postId', removeLike);

export default router;
