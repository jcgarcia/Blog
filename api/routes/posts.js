import express from "express";
import {
  addPost,
  deletePost,
  getPost,
  getPosts,
  getDrafts,
  getAllPosts,
  updatePost,
  searchPosts,
} from "../controllers/post.js";

const router = express.Router();

router.get("/", getPosts);
router.get("/all", getAllPosts);
router.get("/drafts", getDrafts);
router.get("/search", searchPosts);
router.get("/:id", getPost);
router.post("/", addPost);
router.delete("/:id", deletePost);
router.put("/:id", updatePost);

export default router;
