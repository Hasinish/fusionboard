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
  updateWorkspace,
  deleteWorkspace,
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

// rename/update a workspace
router.patch("/:id", authMiddleware, updateWorkspace);

// delete a workspace
router.delete("/:id", authMiddleware, deleteWorkspace);

export default router;
