import driveClient from "../config/googleDrive.js";
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
    const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    // Check for file AND folder ID
    if (!FOLDER_ID) {
       return res.status(500).json({ message: "Server Error: Missing Drive Folder ID" });
    }
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Get the workspaceId sent from the frontend
    const { workspaceId } = req.body; 

    const fileMetadata = {
      name: req.file.originalname,
      parents: [FOLDER_ID],
      // 👇 THIS WAS MISSING! We must tag the file so we can find it later.
      appProperties: {
        workspaceId: workspaceId, 
      },
    };

    const media = {
      mimeType: req.file.mimetype,
      body: bufferToStream(req.file.buffer),
    };

    const response = await driveClient.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });

    res.status(201).json({
      message: "File uploaded successfully",
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

    // This query looks for files that have the 'workspaceId' tag we added above
    const query = `'${FOLDER_ID}' in parents and appProperties has { key='workspaceId' and value='${workspaceId}' } and trashed=false`;

    const response = await driveClient.files.list({
      q: query,
      fields: "files(id, name, mimeType, webViewLink, webContentLink, createdTime, size)",
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
    await driveClient.files.delete({ fileId });
    res.json({ message: "File deleted" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
}