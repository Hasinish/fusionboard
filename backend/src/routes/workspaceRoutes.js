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

// make a new workspace
router.post("/", authMiddleware, createWorkspace);

// invite folks
router.post("/:id/invite", authMiddleware, inviteMembers);

// grab my workspaces
router.get("/my", authMiddleware, getMyWorkspaces);

// get details for one workspace
router.get("/:id", authMiddleware, getWorkspaceById);

// change someone's role
router.patch(
  "/:id/members/:memberId/role",
  authMiddleware,
  updateMemberRole
);

// kick a member
router.delete("/:id/members/:memberId", authMiddleware, removeMember);

export default router;
