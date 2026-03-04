import express from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
    uploadFile,
    listFiles,
    deleteFile,
    getAuthUrl,
    oauthCallback
} from "../controllers/driveController.js";

const router = express.Router();

// Use memory storage so we can stream directly to Drive without saving to disk first
const upload = multer({ storage: multer.memoryStorage() });

// OAuth Flow
router.get("/auth-url/:workspaceId", authMiddleware, getAuthUrl);
router.get("/callback", oauthCallback);
// Note: Callback shouldn't have authMiddleware because redirect comes from Google

// GET /api/drive/workspace/:workspaceId
router.get("/workspace/:workspaceId", authMiddleware, listFiles);

// POST /api/drive/upload
router.post("/upload", authMiddleware, upload.single("file"), uploadFile);

// DELETE /api/drive/:fileId
router.delete("/:fileId", authMiddleware, deleteFile);

export default router;