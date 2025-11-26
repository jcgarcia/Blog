import express from 'express';
import { requireAdminAuth } from '../controllers/admin.js';
import {
  getAllPages,
  getMenuPages,
  getPageBySlug,
  getPageById,
  createPage,
  updatePage,
  deletePage
} from '../controllers/staticPages.js';

const router = express.Router();

// Public routes
router.get('/menu', getMenuPages);           // GET /api/pages/menu - Get pages for navigation menu
router.get('/slug/:slug', getPageBySlug);    // GET /api/pages/slug/about - Get page by slug (public)

// Admin routes (require authentication)
router.get('/', requireAdminAuth, getAllPages);           // GET /api/pages - Get all pages (admin)
router.get('/:id', requireAdminAuth, getPageById);        // GET /api/pages/1 - Get page by ID (admin)
router.post('/', requireAdminAuth, createPage);           // POST /api/pages - Create new page
router.put('/:id', requireAdminAuth, updatePage);         // PUT /api/pages/1 - Update page
router.delete('/:id', requireAdminAuth, deletePage);      // DELETE /api/pages/1 - Delete page

export default router;
