import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  getMyNotifications,
  markWorkspaceRead,
} from "../controllers/notificationController.js";

const router = express.Router();

// grab all my notifs
router.get("/", authMiddleware, getMyNotifications);

// clear unread status for a workspace
router.put("/read/workspace/:workspaceId", authMiddleware, markWorkspaceRead);

export default router;