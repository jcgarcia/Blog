import express from 'express';
import { 
  getComments, 
  addComment, 
  updateComment, 
  deleteComment,
  trackShare,
  getShareStats
} from '../controllers/socialFeatures.js';

const router = express.Router();

// Comment routes
router.get('/posts/:postId/comments', getComments);
router.post('/posts/:postId/comments', addComment);
router.put('/comments/:commentId', updateComment);
router.delete('/comments/:commentId', deleteComment);

// Reply to comment (same as adding comment with parentId)
router.post('/comments/:commentId/reply', (req, res) => {
  // Extract parent comment info and add to request
  req.params.postId = req.body.postId;
  req.body.parentId = req.params.commentId;
  addComment(req, res);
});

// Share tracking routes
router.post('/posts/:postId/share', trackShare);
router.get('/posts/:postId/shares', getShareStats);

export default router;