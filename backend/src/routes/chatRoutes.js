import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getWorkspaceMessages } from "../controllers/chatController.js";

const router = express.Router();

// GET /api/workspaces/:id/messages
router.get("/:id/messages", authMiddleware, getWorkspaceMessages);

export default router;
