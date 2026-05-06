import express from "express";
import multer from "multer";
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
  deleteRecording,
  proxyRecordingAudio
} from "../controllers/recordingController.js";

const router = express.Router();

// Use memory storage so we can pipe directly to Google Drive
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", authMiddleware, startRecording);
router.post("/:id/end", authMiddleware, endRecording);
router.post("/:id/events", authMiddleware, saveEvents);
router.post("/:id/audio", authMiddleware, upload.single("audio"), uploadAudio);
router.post("/:id/checkpoints", authMiddleware, createCheckpoint);

router.get("/:id", authMiddleware, getRecording);
router.get("/:id/events", authMiddleware, getRecordingEvents);
router.get("/:id/audio/stream", authMiddleware, proxyRecordingAudio);
router.get("/board/:boardId", authMiddleware, listBoardRecordings);
router.delete("/:id", authMiddleware, deleteRecording);

export default router;

