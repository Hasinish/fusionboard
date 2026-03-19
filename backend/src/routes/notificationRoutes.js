import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  getMyNotifications,
  markWorkspaceRead,
  markAllRead,
} from "../controllers/notificationController.js";

const router = express.Router();

// grab all my notifs
router.get("/", authMiddleware, getMyNotifications);

// clear unread status for a workspace
router.put("/read/workspace/:workspaceId", authMiddleware, markWorkspaceRead);

// clear all unread status for the user
router.put("/read/all", authMiddleware, markAllRead);

export default router;