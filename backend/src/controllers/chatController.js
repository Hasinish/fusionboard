// backend/src/controllers/chatController.js
import Workspace from "../models/Workspace.js";
import Message from "../models/Message.js";

async function ensureMember(workspaceId, userId) {
  const ws = await Workspace.findById(workspaceId).lean();
  if (!ws) return { ok: false, status: 404, message: "Workspace not found" };

  const isMember = (ws.members || []).some(
    (m) => String(m.user) === String(userId)
  );
  if (!isMember) return { ok: false, status: 403, message: "Not allowed" };

  return { ok: true, workspace: ws };
}

// GET /api/workspaces/:id/messages?limit=50&before=ISO_DATE
export async function getWorkspaceMessages(req, res) {
  try {
    const userId = req.userId;
    const workspaceId = req.params.id;

    const check = await ensureMember(workspaceId, userId);
    if (!check.ok) {
      return res.status(check.status).json({ message: check.message });
    }

    const limitRaw = Number(req.query.limit || 50);
    const limit = Math.min(Math.max(limitRaw, 1), 200);

    const before = req.query.before ? new Date(req.query.before) : null;
    const filter = { workspace: workspaceId };
    if (before && !isNaN(before.getTime())) {
      filter.createdAt = { $lt: before };
    }

    // Fetch latest first, then reverse so UI shows oldest -> newest
    const msgs = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "name email")
      .lean();

    return res.json(msgs.reverse());
  } catch (e) {
    console.error("getWorkspaceMessages error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

export { ensureMember };
