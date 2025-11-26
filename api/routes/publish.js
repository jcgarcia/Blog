import express from "express";
import {
  publishMarkdownPost,
  publishMarkdownContent
} from "../controllers/publish.js";

const router = express.Router();

// POST /api/publish/markdown - Upload and publish a markdown file
router.post("/markdown", publishMarkdownPost);

// POST /api/publish/content - Publish markdown content directly (no file upload)
router.post("/content", publishMarkdownContent);

export default router;
