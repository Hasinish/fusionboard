import Board from "../models/Board.js";
import Workspace from "../models/Workspace.js";
import Notification from "../models/Notification.js";
import Note from "../models/Note.js";
import Activity from "../models/Activity.js"; // [NEW]

async function ensureMember(userId, workspaceId) {
  const ws = await Workspace.findOne({
    _id: workspaceId,
    "members.user": userId,
  }).lean();
  return !!ws;
}

// create a new board in a workspace
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
    });

    // tell everyone else about it
    const ws = await Workspace.findById(workspaceId).select("name members");
    if (ws && ws.members) {
      const recipients = ws.members
        .filter((m) => String(m.user) !== String(userId))
        .map((m) => m.user);

      const operations = recipients.map((recipientId) => ({
        updateOne: {
          filter: {
            recipient: recipientId,
            workspace: workspaceId,
            type: "board",
          },
          update: {
            $set: {
              text: `New board created in ${ws.name}`,
              isRead: false,
            },
          },
          upsert: true,
        },
      }));

      if (operations.length > 0) {
        await Notification.bulkWrite(operations);
      }
    }

    // log what just happened
    await Activity.create({
      workspace: workspaceId,
      user: userId,
      action: "created_board",
      details: board.title,
    });

    return res.status(201).json(board);
  } catch (e) {
    console.error("createBoard error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// grab all boards for a workspace
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

// fetch a specific board
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

// save the latest drawing strokes
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

// rename a board
export async function updateBoard(req, res) {
  try {
    const userId = req.userId;
    const { boardId } = req.params;
    const { title } = req.body;

    const board = await Board.findById(boardId);
    if (!board) return res.status(404).json({ message: "Board not found" });

    const ok = await ensureMember(userId, board.workspace);
    if (!ok) return res.status(403).json({ message: "Not allowed" });

    if (title && board.title !== title) {
      // log the rename event
      await Activity.create({
        workspace: board.workspace,
        user: userId,
        action: "renamed_board",
        details: `From "${board.title}" to "${title}"`,
      });
      board.title = title;
    }

    await board.save();

    return res.json({ message: "Board updated", board });
  } catch (e) {
    console.error("updateBoard error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// trash a board completely
export async function deleteBoard(req, res) {
  try {
    const userId = req.userId;
    const { boardId } = req.params;

    const board = await Board.findById(boardId);
    if (!board) return res.status(404).json({ message: "Board not found" });

    const ok = await ensureMember(userId, board.workspace);
    if (!ok) return res.status(403).json({ message: "Not allowed" });

    // log the deletion
    await Activity.create({
      workspace: board.workspace,
      user: userId,
      action: "deleted_board",
      details: board.title,
    });

    // wipe related notes first so we don't have orphans
    await Note.deleteMany({ board: boardId });

    // actually delete it
    await Board.findByIdAndDelete(boardId);

    return res.json({ message: "Board deleted" });
  } catch (e) {
    console.error("deleteBoard error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}