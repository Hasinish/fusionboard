import Board from "../models/Board.js";
import Workspace from "../models/Workspace.js";

async function ensureMember(userId, workspaceId) {
  const ws = await Workspace.findOne({
    _id: workspaceId,
    "members.user": userId,
  }).lean();
  return !!ws;
}

// POST /api/boards  { workspaceId, title? }
export async function createBoard(req, res) {
  try {
    const userId = req.userId;
    const { workspaceId, title } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ message: "workspaceId is required" });
    }

    const ok = await ensureMember(userId, workspaceId);
    if (!ok) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const board = await Board.create({
      workspace: workspaceId,
      title: title || "Untitled Board",
      segments: [],
    });

    return res.status(201).json(board);
  } catch (e) {
    console.error("createBoard error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/boards/workspace/:workspaceId
export async function listBoards(req, res) {
  try {
    const userId = req.userId;
    const { workspaceId } = req.params;

    const ok = await ensureMember(userId, workspaceId);
    if (!ok) return res.status(403).json({ message: "Not allowed" });

    const boards = await Board.find({ workspace: workspaceId })
      .sort({ updatedAt: -1 })
      .select("_id title updatedAt createdAt")
      .lean();

    return res.json(boards);
  } catch (e) {
    console.error("listBoards error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /api/boards/:boardId
export async function getBoard(req, res) {
  try {
    const userId = req.userId;
    const { boardId } = req.params;

    const board = await Board.findById(boardId).lean();
    if (!board) return res.status(404).json({ message: "Board not found" });

    const ok = await ensureMember(userId, board.workspace);
    if (!ok) return res.status(403).json({ message: "Not allowed" });

    return res.json(board);
  } catch (e) {
    console.error("getBoard error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// PUT /api/boards/:boardId/save  { segments }
export async function saveBoard(req, res) {
  try {
    const userId = req.userId;
    const { boardId } = req.params;
    const { segments } = req.body;

    const board = await Board.findById(boardId);
    if (!board) return res.status(404).json({ message: "Board not found" });

    const ok = await ensureMember(userId, board.workspace);
    if (!ok) return res.status(403).json({ message: "Not allowed" });

    board.segments = Array.isArray(segments) ? segments : [];
    await board.save();

    return res.json({ message: "Board saved", updatedAt: board.updatedAt });
  } catch (e) {
    console.error("saveBoard error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}
