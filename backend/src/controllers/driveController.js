import Workspace from "../models/Workspace.js";
import Activity from "../models/Activity.js";
import { getDriveClient } from "../services/driveService.js";
import { oauth2Client } from "../config/googleDrive.js";
import { Readable } from "stream";

// Helper to convert buffer to stream
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

export async function uploadFile(req, res) {
  try {
    const { workspaceId } = req.body;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // 1. Fetch Workspace and its Drive config
    const workspace = await Workspace.findById(workspaceId).populate("members.user");
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    if (!workspace.googleDriveRefreshToken || !workspace.googleDriveFolderId) {
      return res.status(400).json({ message: "Google Drive is not configured for this workspace." });
    }

    const drive = getDriveClient(workspace.googleDriveRefreshToken);
    const FOLDER_ID = workspace.googleDriveFolderId;

    // Prepare metadata
    const fileMetadata = {
      name: req.file.originalname,
      parents: [FOLDER_ID],
      appProperties: {
        workspaceId: workspaceId,
      },
    };

    const media = {
      mimeType: req.file.mimetype,
      body: bufferToStream(req.file.buffer),
    };

    // 2. Upload the file
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });

    const fileId = response.data.id;

    // 3. Add Permissions for each member
    // We collect all valid emails from the workspace members
    const validEmails = workspace.members
      .map(m => m.user?.email)
      .filter(email => email); // remove null/undefined

    // Use Promise.all to add permissions in parallel
    await Promise.all(validEmails.map(async (email) => {
      try {
        await drive.permissions.create({
          fileId: fileId,
          requestBody: {
            role: 'reader',
            type: 'user',
            emailAddress: email,
          },
        });
        console.log(`Granted access to ${email} for file ${fileId}`);
      } catch (permError) {
        console.error(`Failed to grant permission to ${email}:`, permError.message);
      }
    }));

    // [NEW] Log Activity
    await Activity.create({
      workspace: workspaceId,
      user: req.userId,
      action: "uploaded_file",
      details: req.file.originalname,
    });

    res.status(201).json({
      message: "File uploaded and shared with workspace members",
      file: response.data,
    });

  } catch (error) {
    console.error("Drive upload error:", error);
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
}

export async function listFiles(req, res) {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace || !workspace.googleDriveRefreshToken || !workspace.googleDriveFolderId) {
      return res.json([]); // Return empty list if not configured
    }

    const drive = getDriveClient(workspace.googleDriveRefreshToken);
    const FOLDER_ID = workspace.googleDriveFolderId;

    // This query looks for files that have the 'workspaceId' tag
    const query = `'${FOLDER_ID}' in parents and appProperties has { key='workspaceId' and value='${workspaceId}' } and trashed=false`;

    const response = await drive.files.list({
      q: query,
      fields: "files(id, name, mimeType, webViewLink, webContentLink, createdTime, size, permissions)",
      orderBy: "createdTime desc",
    });

    res.json(response.data.files);
  } catch (error) {
    console.error("Drive list error:", error);
    res.status(500).json({ message: "Could not list files" });
  }
}

export async function deleteFile(req, res) {
  try {
    const { fileId } = req.params;
    const { workspaceId } = req.query;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace || !workspace.googleDriveRefreshToken) {
      return res.status(400).json({ message: "Workspace Drive not configured" });
    }

    const drive = getDriveClient(workspace.googleDriveRefreshToken);

    // [NEW] Get file info first for logging
    try {
      const fileMeta = await drive.files.get({
        fileId,
        fields: "name, appProperties",
      });
      const fileName = fileMeta.data.name || "Unknown File";
      const wsId = fileMeta.data.appProperties?.workspaceId;

      if (wsId) {
        await Activity.create({
          workspace: wsId,
          user: req.userId,
          action: "deleted_file",
          details: fileName,
        });
      }
    } catch (e) {
      console.log("Could not log file deletion:", e.message);
    }

    await drive.files.delete({ fileId });
    res.json({ message: "File deleted" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
}

export async function getAuthUrl(req, res) {
  try {
    const { workspaceId } = req.params;
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    // Only owner can connect Drive
    if (workspace.owner.toString() !== req.userId) {
      return res.status(403).json({ message: "Only the workspace owner can connect Google Drive." });
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/drive"],
      prompt: "consent",
      state: workspaceId,
    });

    res.json({ url: authUrl });
  } catch (error) {
    res.status(500).json({ message: "Could not generate auth URL" });
  }
}

export async function oauthCallback(req, res) {
  const { code, state: workspaceId } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      throw new Error("No refresh token received. Try revoking app access and trying again.");
    }

    const drive = getDriveClient(refreshToken);

    // Create a dedicated folder for this workspace
    const workspace = await Workspace.findById(workspaceId);
    const folderMetadata = {
      name: `FusionBoard - ${workspace.name}`,
      mimeType: "application/vnd.google-apps.folder",
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: "id",
    });

    // Save to workspace
    workspace.googleDriveRefreshToken = refreshToken;
    workspace.googleDriveFolderId = folder.data.id;
    await workspace.save();

    // Redirect to frontend
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/workspaces/${workspaceId}/files?status=success`);
  } catch (error) {
    console.error("OAuth Callback Error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/workspaces/${workspaceId}/files?status=error&message=${encodeURIComponent(error.message)}`);
  }
}