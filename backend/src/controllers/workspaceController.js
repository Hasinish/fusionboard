// backend/src/controllers/workspaceController.js
import Workspace from "../models/Workspace.js";
import User from "../models/User.js";
import Invitation from "../models/Invitation.js";

const ONLINE_THRESHOLD_MS = 1000 * 60 * 5; // 5 minutes

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

    // Create workspace with owner as first member (role: owner)
    const workspace = await Workspace.create({
      name,
      description: description || "",
      owner: owner._id,
      members: [
        {
          user: owner._id,
          role: "owner",
        },
      ],
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

// Invite new members (by email) from an existing workspace (owner only)
export async function inviteMembers(req, res) {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { memberEmails } = req.body;

    if (!Array.isArray(memberEmails) || memberEmails.length === 0) {
      return res.status(400).json({ message: "No emails provided" });
    }

    const workspace = await Workspace.findById(id)
      .populate("owner", "email")
      .populate("members.user", "email");

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    if (String(workspace.owner._id) !== String(userId)) {
      return res.status(403).json({ message: "Only owner can invite members" });
    }

    const ownerEmail = workspace.owner.email.toLowerCase();

    for (const rawEmail of memberEmails) {
      const email = String(rawEmail).trim().toLowerCase();
      if (!email) continue;
      if (email === ownerEmail) continue;

      const invitedUser = await User.findOne({ email });
      if (!invitedUser) {
        continue;
      }

      const alreadyMember = workspace.members.some(
        (m) =>
          String(m.user._id || m.user) === String(invitedUser._id)
      );
      if (alreadyMember) continue;

      const existingInvite = await Invitation.findOne({
        workspace: workspace._id,
        invitedUser: invitedUser._id,
        status: "pending",
      });
      if (existingInvite) continue;

      await Invitation.create({
        workspace: workspace._id,
        invitedBy: workspace.owner._id,
        invitedUser: invitedUser._id,
      });
    }

    return res.json({ message: "Invitations sent (for registered users)." });
  } catch (e) {
    console.error("Error inviting members:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// Get all workspaces where the user is a member
export async function getMyWorkspaces(req, res) {
  try {
    const userId = req.userId;

    const workspaces = await Workspace.find({
      "members.user": userId,
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
      .populate("owner", "name email lastActive")
      .populate("members.user", "name email lastActive")
      .lean();

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const isMember = (workspace.members || []).some(
      (m) => String(m.user?._id || m.user) === String(userId)
    );

    if (!isMember) {
      return res
        .status(403)
        .json({ message: "Not allowed to view workspace" });
    }

    const now = Date.now();

    let ownerData = null;
    if (workspace.owner) {
      const lastActive = workspace.owner.lastActive
        ? new Date(workspace.owner.lastActive).getTime()
        : 0;
      const isOnline =
        lastActive > 0 && now - lastActive < ONLINE_THRESHOLD_MS;

      ownerData = {
        _id: workspace.owner._id,
        name: workspace.owner.name,
        email: workspace.owner.email,
        isOnline,
      };
    }

    const members = (workspace.members || [])
      .map((m) => {
        const u = m.user;
        if (!u) return null;
        const lastActive = u.lastActive
          ? new Date(u.lastActive).getTime()
          : 0;
        const isOnline =
          lastActive > 0 && now - lastActive < ONLINE_THRESHOLD_MS;

        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          role: m.role,
          isOnline,
        };
      })
      .filter(Boolean);

    return res.json({
      _id: workspace._id,
      name: workspace.name,
      description: workspace.description,
      owner: ownerData,
      members,
    });
  } catch (e) {
    console.error("Error fetching workspace:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// Change a member's role (owner, editor, viewer) – only owner can do this
export async function updateMemberRole(req, res) {
  try {
    const userId = req.userId;
    const { id, memberId } = req.params;
    const { role } = req.body;

    const allowedRoles = ["owner", "editor", "viewer"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const workspace = await Workspace.findById(id).populate("owner", "_id");
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    if (String(workspace.owner._id) !== String(userId)) {
      return res
        .status(403)
        .json({ message: "Only owner can change member roles" });
    }

    const member = workspace.members.find(
      (m) => String(m.user) === String(memberId)
    );
    if (!member) {
      return res.status(404).json({ message: "Member not found in workspace" });
    }

    // Do not allow owner to make themselves non-owner using this endpoint
    if (
      String(workspace.owner._id) === String(memberId) &&
      role !== "owner"
    ) {
      return res.status(400).json({
        message:
          "To change owner, assign role 'owner' to another member first.",
      });
    }

    if (role === "owner") {
      // Transfer ownership: new owner gets owner role, old owner becomes editor
      workspace.members.forEach((m) => {
        if (String(m.user) === String(memberId)) {
          m.role = "owner";
        } else if (m.role === "owner") {
          m.role = "editor"; // demote previous owner
        }
      });
      workspace.owner = member.user;
    } else {
      member.role = role;
    }

    await workspace.save();

    return res.json({ message: "Member role updated" });
  } catch (e) {
    console.error("Error updating member role:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// Remove a member from workspace – only owner, cannot remove owner
export async function removeMember(req, res) {
  try {
    const userId = req.userId;
    const { id, memberId } = req.params;

    const workspace = await Workspace.findById(id).populate("owner", "_id");
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    if (String(workspace.owner._id) !== String(userId)) {
      return res
        .status(403)
        .json({ message: "Only owner can remove members" });
    }

    if (String(workspace.owner._id) === String(memberId)) {
      return res
        .status(400)
        .json({ message: "Owner cannot be removed from the workspace" });
    }

    const beforeCount = workspace.members.length;
    workspace.members = workspace.members.filter(
      (m) => String(m.user) !== String(memberId)
    );

    if (workspace.members.length === beforeCount) {
      return res
        .status(404)
        .json({ message: "Member not found in workspace" });
    }

    await workspace.save();

    return res.json({ message: "Member removed from workspace" });
  } catch (e) {
    console.error("Error removing member:", e);
    return res.status(500).json({ message: "Server error" });
  }
}
