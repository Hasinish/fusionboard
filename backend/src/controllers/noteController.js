import Note from "../models/Note.js";
import Board from "../models/Board.js";
import Workspace from "../models/Workspace.js";

// Helper: Ensure user belongs to the workspace
async function checkAccess(userId, boardId) {
  const board = await Board.findById(boardId);
  if (!board) return false;
  
  const workspace = await Workspace.findById(board.workspace);
  if (!workspace) return false;

  return workspace.members.some((m) => String(m.user) === String(userId));
}

export async function createNote(req, res) {
  try {
    const { boardId, content } = req.body;
    const userId = req.userId;

    if (!content.trim()) return res.status(400).json({ message: "Empty note" });
    const hasAccess = await checkAccess(userId, boardId);
    if (!hasAccess) return res.status(403).json({ message: "Access denied" });

    const note = await Note.create({ board: boardId, user: userId, content });
    res.status(201).json(note);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
}

export async function getMyNotes(req, res) {
  try {
    const { boardId } = req.params;
    const userId = req.userId;

    const hasAccess = await checkAccess(userId, boardId);
    if (!hasAccess) return res.status(403).json({ message: "Access denied" });

    const notes = await Note.find({ board: boardId, user: userId }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
}

// 👇 NEW: Update Note Function
export async function updateNote(req, res) {
  try {
    const { noteId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (String(note.user) !== String(userId)) {
      return res.status(403).json({ message: "Not your note" });
    }

    note.content = content;
    await note.save();
    res.json(note);
  } catch (e) {
    res.status(500).json({ message: "Update failed" });
  }
}

export async function deleteNote(req, res) {
  try {
    const { noteId } = req.params;
    const userId = req.userId;

    const note = await Note.findById(noteId);
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (String(note.user) !== String(userId)) {
      return res.status(403).json({ message: "Not your note" });
    }

    await note.deleteOne();
    res.json({ message: "Note deleted" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
}