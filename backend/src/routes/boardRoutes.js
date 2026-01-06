import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  createBoard,
  listBoards,
  getBoard,
  saveBoard,
  updateBoard,
  deleteBoard, 
} from "../controllers/boardController.js";

const router = express.Router();

router.post("/", authMiddleware, createBoard);
router.get("/workspace/:workspaceId", authMiddleware, listBoards);
router.get("/:boardId", authMiddleware, getBoard);
router.put("/:boardId/save", authMiddleware, saveBoard);
router.patch("/:boardId", authMiddleware, updateBoard);
router.delete("/:boardId", authMiddleware, deleteBoard); 

export default router;