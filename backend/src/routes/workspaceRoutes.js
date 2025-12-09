// backend/src/routes/workspaceRoutes.js
import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  createWorkspace,
  getMyWorkspaces,
  getWorkspaceById,
  inviteMembers,
  updateMemberRole,
  removeMember,
} from "../controllers/workspaceController.js";

const router = express.Router();

// POST /api/workspaces
router.post("/", authMiddleware, createWorkspace);

// POST /api/workspaces/:id/invite
router.post("/:id/invite", authMiddleware, inviteMembers);

// GET /api/workspaces/my
router.get("/my", authMiddleware, getMyWorkspaces);

// GET /api/workspaces/:id
router.get("/:id", authMiddleware, getWorkspaceById);

// PATCH /api/workspaces/:id/members/:memberId/role
router.patch(
  "/:id/members/:memberId/role",
  authMiddleware,
  updateMemberRole
);

// DELETE /api/workspaces/:id/members/:memberId
router.delete("/:id/members/:memberId", authMiddleware, removeMember);

export default router;
