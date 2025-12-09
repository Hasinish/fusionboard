// backend/src/routes/invitationRoutes.js
import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  getMyInvitations,
  acceptInvitation,
  rejectInvitation,
} from "../controllers/invitationController.js";

const router = express.Router();

// GET /api/invitations/my
router.get("/my", authMiddleware, getMyInvitations);

// POST /api/invitations/:id/accept
router.post("/:id/accept", authMiddleware, acceptInvitation);

// POST /api/invitations/:id/reject
router.post("/:id/reject", authMiddleware, rejectInvitation);

export default router;
