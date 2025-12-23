import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  getMyInvitations,
  acceptInvitation,
  rejectInvitation,
  getWorkspacePendingInvitations, // [NEW]
} from "../controllers/invitationController.js";

const router = express.Router();

// GET /api/invitations/my
router.get("/my", authMiddleware, getMyInvitations);

// [NEW] GET /api/invitations/workspace/:workspaceId (Get pending invite UserIDs)
router.get("/workspace/:workspaceId", authMiddleware, getWorkspacePendingInvitations);

// POST /api/invitations/:id/accept
router.post("/:id/accept", authMiddleware, acceptInvitation);

// POST /api/invitations/:id/reject
router.post("/:id/reject", authMiddleware, rejectInvitation);

export default router;