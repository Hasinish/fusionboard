import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { createNote, getMyNotes, deleteNote, updateNote } from "../controllers/noteController.js";

const router = express.Router();

router.post("/", authMiddleware, createNote);
router.get("/:boardId", authMiddleware, getMyNotes);
router.put("/:noteId", authMiddleware, updateNote); // 👈 NEW ROUTE
router.delete("/:noteId", authMiddleware, deleteNote);

export default router;