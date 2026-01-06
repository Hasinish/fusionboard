import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getWorkspaceActivities } from "../controllers/activityController.js";

const router = express.Router();

router.get("/:workspaceId", authMiddleware, getWorkspaceActivities);

export default router;