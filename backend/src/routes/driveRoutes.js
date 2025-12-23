import express from "express";
import multer from "multer";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { uploadFile, listFiles, deleteFile } from "../controllers/driveController.js";

const router = express.Router();

// Use memory storage so we can stream directly to Drive without saving to disk first
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/drive/workspace/:workspaceId
router.get("/workspace/:workspaceId", authMiddleware, listFiles);

// POST /api/drive/upload
router.post("/upload", authMiddleware, upload.single("file"), uploadFile);

// DELETE /api/drive/:fileId
router.delete("/:fileId", authMiddleware, deleteFile);

export default router;