import Workspace from "../models/Workspace.js";
import Activity from "../models/Activity.js";
import { getDriveClient } from "../services/driveService.js";
import { oauth2Client } from "../config/googleDrive.js";
import { Readable } from "stream";

// handy trick to turn a buffer into a stream
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

function getMemberRole(workspace, userId) {
  if (!workspace || !workspace.members) return null;
  const m = workspace.members.find(mm => String(mm.user) === String(userId));
  return m ? m.role : null;
}

export async function uploadFile(req, res) {
  try {
    const { workspaceId } = req.body;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // 1. grab the workspace and its gdrive setup
    const workspace = await Workspace.findById(workspaceId).populate("members.user");
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    // viewers are not allowed to upload files
    const uploaderRole = getMemberRole(workspace, req.userId);
    if (uploaderRole === "viewer") return res.status(403).json({ message: "Viewers cannot upload files" });

    if (!workspace.googleDriveRefreshToken || !workspace.googleDriveFolderId) {
      return res.status(400).json({ message: "Google Drive is not configured for this workspace." });
    }

    const drive = getDriveClient(workspace.googleDriveRefreshToken);
    const FOLDER_ID = workspace.googleDriveFolderId;

    // set up the file info for google
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

    // 2. chuck it into google drive
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });

    const fileId = response.data.id;

    // 3. give all the workspace members access to it
    // gather up everyone's email
    const validEmails = workspace.members
      .map(m => m.user?.email)
      .filter(email => email); // remove null/undefined

    // speed this up by doing them all at once
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

    // log the upload
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

    // viewers should not be able to view/download files
    const listerRole = getMemberRole(workspace, req.userId);
    if (listerRole === "viewer") return res.status(403).json({ message: "Viewers cannot view or download workspace files" });

    const drive = getDriveClient(workspace.googleDriveRefreshToken);
    const FOLDER_ID = workspace.googleDriveFolderId;

    // hunt down files tagged with this workspace ID
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

    // viewers are not allowed to delete files
    const deleterRole = getMemberRole(workspace, req.userId);
    if (deleterRole === "viewer") return res.status(403).json({ message: "Viewers cannot delete workspace files" });

    const drive = getDriveClient(workspace.googleDriveRefreshToken);

    // grab the file info so we can log what was deleted
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

    // gotta be the boss to link the drive
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

    // make a shiny new folder just for this workspace
    const workspace = await Workspace.findById(workspaceId);
    const folderMetadata = {
      name: `FusionBoard - ${workspace.name}`,
      mimeType: "application/vnd.google-apps.folder",
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: "id",
    });

    // save the new creds
    workspace.googleDriveRefreshToken = refreshToken;
    workspace.googleDriveFolderId = folder.data.id;
    await workspace.save();

    // send them back to the app
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/workspaces/${workspaceId}/files?status=success`);
  } catch (error) {
    console.error("OAuth Callback Error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/workspaces/${workspaceId}/files?status=error&message=${encodeURIComponent(error.message)}`);
  }
}

export async function proxyDownload(req, res) {
  const { fileId } = req.params;
  const { workspaceId } = req.query;
  console.log(`[Drive] Proxy download request: fileId=${fileId}, workspaceId=${workspaceId}`);

  try {

    if (!workspaceId) return res.status(400).json({ message: "workspaceId is required" });

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace || !workspace.googleDriveRefreshToken) {
      return res.status(400).json({ message: "Workspace Drive not configured" });
    }

    // viewers are not allowed to download files (consistent with listFiles)
    const role = getMemberRole(workspace, req.userId);
    if (role === "viewer") return res.status(403).json({ message: "Viewers cannot download files" });

    const drive = getDriveClient(workspace.googleDriveRefreshToken);

    // 1. Get file metadata
    const fileMeta = await drive.files.get({
      fileId,
      fields: "name, mimeType, size",
    });

    const isGoogleDoc = fileMeta.data.mimeType.startsWith("application/vnd.google-apps.");
    let fileName = fileMeta.data.name;
    let mimeType = fileMeta.data.mimeType;
    let downloadResponse;

    if (isGoogleDoc) {
      // Map Google Docs to PDF or Office formats for download
      let exportMimeType = "application/pdf";
      if (mimeType.includes("document")) {
        exportMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        fileName += ".docx";
      } else if (mimeType.includes("spreadsheet")) {
        exportMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        fileName += ".xlsx";
      } else if (mimeType.includes("presentation")) {
        exportMimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        fileName += ".pptx";
      } else {
        fileName += ".pdf";
      }
      
      console.log(`[Drive] Exporting Google Doc: ${fileId} as ${exportMimeType}`);
      mimeType = exportMimeType;
      downloadResponse = await drive.files.export(
        { fileId, mimeType: exportMimeType },
        { responseType: "stream" }
      );
    } else {
      console.log(`[Drive] Getting regular file: ${fileId}`);
      downloadResponse = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "stream" }
      );
    }

    // 3. Set headers
    res.setHeader("Content-Type", mimeType);
    const disposition = mimeType.startsWith("image/") ? "inline" : "attachment";
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${encodeURIComponent(fileName)}"`
    );
    // Don't set Content-Length for Google Doc exports as the size is unknown until streaming completes
    if (!isGoogleDoc && fileMeta.data.size) {
      res.setHeader("Content-Length", fileMeta.data.size);
    }

    // 4. Pipe the stream
    downloadResponse.data
      .on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      })
      .pipe(res);

  } catch (error) {
    console.error("Proxy download error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Download failed", error: error.message });
    }
  }
}