import express from "express";
import { sendContactMessage } from "../controllers/contact.js";

const router = express.Router();

// POST /api/contact - Send contact form message
router.post("/", sendContactMessage);

export default router;
