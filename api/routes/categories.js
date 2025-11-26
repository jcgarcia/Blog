import express from "express";
import { getCategories, addCategory, deleteCategory, updateCategory } from "../controllers/category.js";

const router = express.Router();

router.get("/", getCategories);
router.post("/", addCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
