// backend/src/controllers/workspaceController.js
import Workspace from "../models/Workspace.js";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";

// Create a new workspace and send invitations
export async function createWorkspace(req, res) {
  try {
    const userId = req.userId;
    const { name, description, memberEmails } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Workspace name is required" });
    }

    const owner = await User.findById(userId);
    if (!owner) {
      return res.status(404).json({ message: "Owner user not found" });
    }

    // Create workspace with owner as first member
    const workspace = await Workspace.create({
      name,
      description: description || "",
      owner: owner._id,
      members: [owner._id],
    });

    // memberEmails is expected as an array of strings
    if (Array.isArray(memberEmails)) {
      for (const rawEmail of memberEmails) {
        const email = String(rawEmail).trim().toLowerCase();
        if (!email) continue;
        if (email === owner.email.toLowerCase()) continue; // skip self

        const invitedUser = await User.findOne({ email });
        if (!invitedUser) {
          // If user not registered, skip silently for now
          continue;
        }

        // Avoid duplicate invitation
        const existingInvite = await Invitation.findOne({
          workspace: workspace._id,
          invitedUser: invitedUser._id,
          status: "pending",
        });

        if (!existingInvite) {
          await Invitation.create({
            workspace: workspace._id,
            invitedBy: owner._id,
            invitedUser: invitedUser._id,
          });
        }
      }
    }

    return res.status(201).json({
      message: "Workspace created successfully",
      workspace,
    });
  } catch (e) {
    console.error("Error creating workspace:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// Get all workspaces where the user is owner or member
export async function getMyWorkspaces(req, res) {
  try {
    const userId = req.userId;

    const workspaces = await Workspace.find({
      $or: [{ owner: userId }, { members: userId }],
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(workspaces);
  } catch (e) {
    console.error("Error fetching workspaces:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// Get details of a single workspace (only if user is member/owner)
export async function getWorkspaceById(req, res) {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const workspace = await Workspace.findById(id)
      .populate("owner", "name email")
      .populate("members", "name email")
      .lean();

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const isOwner = String(workspace.owner._id) === String(userId);
    const isMember = (workspace.members || []).some(
      (m) => String(m._id) === String(userId)
    );

    if (!isOwner && !isMember) {
      return res.status(403).json({ message: "Not allowed to view workspace" });
    }

    return res.json(workspace);
  } catch (e) {
    console.error("Error fetching workspace:", e);
    return res.status(500).json({ message: "Server error" });
  }
}
