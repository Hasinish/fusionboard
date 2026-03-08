import Activity from "../models/Activity.js";
import Workspace from "../models/Workspace.js";

// fetch the activity feed for a workspace
export async function getWorkspaceActivities(req, res) {
  try {
    const { workspaceId } = req.params;
    const userId = req.userId;

    // make sure they're allowed to see this
    const ws = await Workspace.findOne({
      _id: workspaceId,
      "members.user": userId,
    });
    if (!ws) return res.status(403).json({ message: "Access denied" });

    // grab the latest stuff
    const activities = await Activity.find({ workspace: workspaceId })
      .sort({ createdAt: -1 })
      .limit(50) // don't bog down the system, just get the last 50
      .populate("user", "name email")
      .lean();

    res.json(activities);
  } catch (e) {
    console.error("Error fetching activities:", e);
    res.status(500).json({ message: "Server error" });
  }
}