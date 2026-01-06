import Activity from "../models/Activity.js";
import Workspace from "../models/Workspace.js";

// GET /api/activities/:workspaceId
export async function getWorkspaceActivities(req, res) {
  try {
    const { workspaceId } = req.params;
    const userId = req.userId;

    // Ensure access
    const ws = await Workspace.findOne({
      _id: workspaceId,
      "members.user": userId,
    });
    if (!ws) return res.status(403).json({ message: "Access denied" });

    // Fetch activities (newest first)
    const activities = await Activity.find({ workspace: workspaceId })
      .sort({ createdAt: -1 })
      .limit(50) // Limit to last 50 entries
      .populate("user", "name email")
      .lean();

    res.json(activities);
  } catch (e) {
    console.error("Error fetching activities:", e);
    res.status(500).json({ message: "Server error" });
  }
}