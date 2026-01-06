import Invitation from "../models/Invitation.js";
import Workspace from "../models/Workspace.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js"; // [NEW] Import User to get email
import driveClient from "../config/googleDrive.js"; // [NEW] Import Drive Client

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

// Get pending invitations for a specific workspace (returns list of user IDs)
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

// [UPDATED] Accept Invitation & Sync Drive Permissions
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

    // 1. Mark invitation as accepted
    invitation.status = "accepted";
    await invitation.save();

    const workspace = await Workspace.findById(invitation.workspace);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // 2. Add user to workspace DB members
    const alreadyMember = workspace.members.some(
      (m) => String(m.user) === String(userId)
    );
    
    if (!alreadyMember) {
      workspace.members.push({ user: userId, role: "viewer" });
      await workspace.save();

      // [NEW] 3. GRANT GOOGLE DRIVE ACCESS FOR HISTORICAL FILES
      try {
        const userEmail = invitation.invitedUser?.email;
        if (userEmail) {
            const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
            
            // Find all files belonging to this workspace
            const query = `'${FOLDER_ID}' in parents and appProperties has { key='workspaceId' and value='${workspace._id}' } and trashed=false`;
            
            const driveRes = await driveClient.files.list({
                q: query,
                fields: "files(id, name)",
            });

            const files = driveRes.data.files || [];
            
            if (files.length > 0) {
                console.log(`Granting access to ${files.length} files for new member ${userEmail}...`);
                
                // Process in parallel
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
        // We do NOT stop the request here; the user joined successfully even if Drive sync failed partially.
      }

      // 4. Notify Owner
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