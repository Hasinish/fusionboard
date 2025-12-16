import Invitation from "../models/Invitation.js";
import Workspace from "../models/Workspace.js";

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

export async function acceptInvitation(req, res) {
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
      // Default role for new members is viewer
      workspace.members.push({ user: userId, role: "viewer" });
      await workspace.save();
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

