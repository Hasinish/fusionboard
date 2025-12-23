import Invitation from "../models/Invitation.js";
import Workspace from "../models/Workspace.js";
import Notification from "../models/Notification.js";

// Get pending invitations for logged-in user
export async function getMyInvitations(req, res) {
  try {
    const userId = req.userId;
    const invitations = await Invitation.find({
      invitedUser: userId,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .populate("workspace", "name")
      .populate("invitedBy", "name email")
      .lean();

    return res.json(invitations);
  } catch (e) {
    console.error("Error fetching invitations:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// [NEW] Get pending invitations for a specific workspace (returns list of user IDs)
export async function getWorkspacePendingInvitations(req, res) {
  try {
    const userId = req.userId;
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Check if requester is a member/owner
    const isMember = workspace.members.some(
      (m) => String(m.user) === String(userId)
    );
    if (!isMember) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // Find all pending invitations for this workspace
    const invitations = await Invitation.find({
      workspace: workspaceId,
      status: "pending",
    }).select("invitedUser");

    // Return just the array of user IDs
    const invitedUserIds = invitations.map((i) => i.invitedUser);
    return res.json(invitedUserIds);
  } catch (e) {
    console.error("Error fetching workspace invitations:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function acceptInvitation(req, res) {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const invitation = await Invitation.findOne({
      _id: id,
      invitedUser: userId,
    }).populate("invitedUser", "name");

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ message: "Invitation already processed" });
    }

    invitation.status = "accepted";
    await invitation.save();

    const workspace = await Workspace.findById(invitation.workspace);

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const alreadyMember = workspace.members.some(
      (m) => String(m.user) === String(userId)
    );

    if (!alreadyMember) {
      workspace.members.push({ user: userId, role: "viewer" });
      await workspace.save();

      try {
        const joinerName = invitation.invitedUser?.name || "A user";
        await Notification.updateOne(
          {
            recipient: workspace.owner,
            workspace: workspace._id,
            type: "join",
          },
          {
            $set: {
              text: `${joinerName} joined ${workspace.name}`,
              isRead: false,
            },
          },
          { upsert: true }
        );
      } catch (noteError) {
        console.error("Failed to create join notification:", noteError);
      }
    }

    return res.json({ message: "Invitation accepted" });
  } catch (e) {
    console.error("Error accepting invitation:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

export async function rejectInvitation(req, res) {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const invitation = await Invitation.findOne({
      _id: id,
      invitedUser: userId,
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ message: "Invitation already processed" });
    }

    invitation.status = "rejected";
    await invitation.save();

    return res.json({ message: "Invitation rejected" });
  } catch (e) {
    console.error("Error rejecting invitation:", e);
    return res.status(500).json({ message: "Server error" });
  }
}