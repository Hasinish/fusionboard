import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  createBoard,
  listBoards,
  getBoard,
  saveBoard,
  updateBoard, // [NEW]
} from "../controllers/boardController.js";

const router = express.Router();

router.post("/", authMiddleware, createBoard);
router.get("/workspace/:workspaceId", authMiddleware, listBoards);
router.get("/:boardId", authMiddleware, getBoard);
router.put("/:boardId/save", authMiddleware, saveBoard);
router.patch("/:boardId", authMiddleware, updateBoard); // [NEW]

export default router;