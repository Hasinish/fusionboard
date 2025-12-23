import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  getMyNotifications,
  markWorkspaceRead,
} from "../controllers/notificationController.js";

const router = express.Router();

// Get all notifications for the user
router.get("/", authMiddleware, getMyNotifications);

// Mark messages from a specific workspace as read
router.put("/read/workspace/:workspaceId", authMiddleware, markWorkspaceRead);

export default router;