import driveClient from "../config/googleDrive.js";
import { Readable } from "stream";
import Workspace from "../models/Workspace.js"; 
import Activity from "../models/Activity.js"; // [NEW]

// Helper to convert buffer to stream
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

export async function uploadFile(req, res) {
  try {
    const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

    // Check for file AND folder ID
    if (!FOLDER_ID) {
       return res.status(500).json({ message: "Server Error: Missing Drive Folder ID" });
    }
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Get the workspaceId sent from the frontend
    const { workspaceId } = req.body;

    // 1. Fetch Workspace Members to get their emails
    const workspace = await Workspace.findById(workspaceId).populate("members.user");
    if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
    }

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
    const response = await driveClient.files.create({
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
            await driveClient.permissions.create({
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
    const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const { workspaceId } = req.params;

    // This query looks for files that have the 'workspaceId' tag
    const query = `'${FOLDER_ID}' in parents and appProperties has { key='workspaceId' and value='${workspaceId}' } and trashed=false`;
    
    const response = await driveClient.files.list({
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

    // [NEW] Get file info first for logging
    try {
        const fileMeta = await driveClient.files.get({
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

    await driveClient.files.delete({ fileId });
    res.json({ message: "File deleted" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
}