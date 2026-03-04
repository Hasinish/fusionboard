import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  getMyInvitations,
  acceptInvitation,
  rejectInvitation,
  getWorkspacePendingInvitations, // added to check pending stuff
} from "../controllers/invitationController.js";

const router = express.Router();

// fetch my invites
router.get("/my", authMiddleware, getMyInvitations);

// see who we already invited
router.get("/workspace/:workspaceId", authMiddleware, getWorkspacePendingInvitations);

// say yes to invite
router.post("/:id/accept", authMiddleware, acceptInvitation);

// say no to invite
router.post("/:id/reject", authMiddleware, rejectInvitation);

export default router;