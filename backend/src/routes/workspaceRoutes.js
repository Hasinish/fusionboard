// backend/src/routes/workspaceRoutes.js
import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  createWorkspace,
  getMyWorkspaces,
  getWorkspaceById,
} from "../controllers/workspaceController.js";

const router = express.Router();

// POST /api/workspaces
router.post("/", authMiddleware, createWorkspace);

// GET /api/workspaces/my
router.get("/my", authMiddleware, getMyWorkspaces);

// GET /api/workspaces/:id
router.get("/:id", authMiddleware, getWorkspaceById);

export default router;
