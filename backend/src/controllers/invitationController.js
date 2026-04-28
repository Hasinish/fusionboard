import Invitation from "../models/Invitation.js";
import Workspace from "../models/Workspace.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js"; // [NEW] Import User to get email
import driveClient from "../config/googleDrive.js"; // [NEW] Import Drive Client
import { emitToUser, emitToWorkspace } from "../startup/socket.js";

// fetch any invites waiting for me
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

// see who still hasn't accepted their invite here
export async function getWorkspacePendingInvitations(req, res) {
  try {
    const userId = req.userId;
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // gotta be inside the workspace to peek at this
    const isMember = workspace.members.some(
      (m) => String(m.user) === String(userId)
    );
    if (!isMember) {
      return res.status(403).json({ message: "Not allowed" });
    }

    // grab all the unanswered invites
    const invitations = await Invitation.find({
      workspace: workspaceId,
      status: "pending",
    }).select("invitedUser");

    // just spit out the user IDs
    const invitedUserIds = invitations.map((i) => i.invitedUser);
    return res.json(invitedUserIds);
  } catch (e) {
    console.error("Error fetching workspace invitations:", e);
    return res.status(500).json({ message: "Server error" });
  }
}

// say yes to an invite and wire up google drive
export async function acceptInvitation(req, res) {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const invitation = await Invitation.findOne({
      _id: id,
      invitedUser: userId,
    }).populate("invitedUser", "name email"); // [UPDATED] Fetch email too

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ message: "Invitation already processed" });
    }

    // 1. flip the invite to accepted
    invitation.status = "accepted";
    await invitation.save();

    const workspace = await Workspace.findById(invitation.workspace);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // 2. actually add them to the workspace
    const alreadyMember = workspace.members.some(
      (m) => String(m.user) === String(userId)
    );

    if (!alreadyMember) {
      workspace.members.push({ user: userId, role: "viewer" });
      await workspace.save();

      // 3. give them access to all the old files in drive
      try {
        const userEmail = invitation.invitedUser?.email;
        if (userEmail) {
          const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

          // hunt down all the workspace's files
          const query = `'${FOLDER_ID}' in parents and appProperties has { key='workspaceId' and value='${workspace._id}' } and trashed=false`;

          const driveRes = await driveClient.files.list({
            q: query,
            fields: "files(id, name)",
          });

          const files = driveRes.data.files || [];

          if (files.length > 0) {
            console.log(`Granting access to ${files.length} files for new member ${userEmail}...`);

            // speed run granting permissions
            await Promise.all(files.map(file =>
              driveClient.permissions.create({
                fileId: file.id,
                requestBody: {
                  role: 'reader',
                  type: 'user',
                  emailAddress: userEmail,
                },
                // invitationNotificationEmail: false // Optional: suppress emails
              }).catch(err => {
                console.error(`Failed to share file ${file.id} with ${userEmail}:`, err.message);
              })
            ));
          }
        }
      } catch (driveError) {
        console.error("Error syncing Drive permissions on join:", driveError);
        // ignore drive errors so we don't block them from joining
      }

      // 4. tell the boss they joined
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

    // 5. Tell the user's dashboard to refresh its list
    emitToUser(userId, "workspace:joined", {
      workspaceId: workspace._id,
      workspaceName: workspace.name,
    });
    
    emitToWorkspace(workspace._id, "workspace:members-updated", { workspaceId: workspace._id });

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