import Notification from "../models/Notification.js";

// GET /api/notifications
export async function getMyNotifications(req, res) {
  try {
    const userId = req.userId;
    const notifications = await Notification.find({ recipient: userId })
      .populate("workspace", "name")
      .sort({ updatedAt: -1 }) // Newest first
      .lean();
    return res.json(notifications);
  } catch (e) {
    console.error("Error fetching notifications:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// PUT /api/notifications/read/workspace/:workspaceId
export async function markWorkspaceRead(req, res) {
  try {
    const userId = req.userId;
    const { workspaceId } = req.params;

    await Notification.updateMany(
      { recipient: userId, workspace: workspaceId, type: "message" },
      { $set: { isRead: true } }
    );

    return res.json({ message: "Marked as read" });
  } catch (e) {
    console.error("Error marking read:", e);
    return res.status(500).json({ message: "Server error" });
  }
}