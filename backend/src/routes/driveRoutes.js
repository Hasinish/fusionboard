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

// keep it in memory so we can pipe it straight to google drive (no disk writing)
const upload = multer({ storage: multer.memoryStorage() });

// oauth stuff needs to go through here
router.get("/auth-url/:workspaceId", authMiddleware, getAuthUrl);
router.get("/callback", oauthCallback);
// skip auth middleware here since google redirects them back to us

// fetch files for a given workspace
router.get("/workspace/:workspaceId", authMiddleware, listFiles);

// upload a new file
router.post("/upload", authMiddleware, upload.single("file"), uploadFile);

// trash a file
router.delete("/:fileId", authMiddleware, deleteFile);

export default router;