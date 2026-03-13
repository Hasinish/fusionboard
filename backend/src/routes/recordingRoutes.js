import express from "express";
import multer from "multer";
import path from "path";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  startRecording,
  endRecording,
  saveEvents,
  uploadAudio,
  getRecording,
  getRecordingEvents,
  listBoardRecordings,
  createCheckpoint,
  deleteRecording
} from "../controllers/recordingController.js";

const router = express.Router();

// Multer setup for audio
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Relative to the root or where process.cwd() is (usually backend root)
    cb(null, "uploads/recordings/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `audio-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

router.post("/", authMiddleware, startRecording);
router.post("/:id/end", authMiddleware, endRecording);
router.post("/:id/events", authMiddleware, saveEvents);
router.post("/:id/audio", authMiddleware, upload.single("audio"), uploadAudio);
router.post("/:id/checkpoints", authMiddleware, createCheckpoint);

router.get("/:id", authMiddleware, getRecording);
router.get("/:id/events", authMiddleware, getRecordingEvents);
router.get("/board/:boardId", authMiddleware, listBoardRecordings);
router.delete("/:id", authMiddleware, deleteRecording);

export default router;
