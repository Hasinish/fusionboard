import RecordingSession from "../models/RecordingSession.js";
import RecordingEvent from "../models/RecordingEvent.js";
import RecordingCheckpoint from "../models/RecordingCheckpoint.js";
import Workspace from "../models/Workspace.js";
import { getDriveClient } from "../services/driveService.js";
import { Readable } from "stream";
import fs from "fs";
import path from "path";

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

// Helper to calculate duration
const calculateDuration = (start, end) => {
  return new Date(end) - new Date(start);
};

export const startRecording = async (req, res) => {
  try {
    const { boardId, workspaceId, title, initialSnapshot } = req.body;
    const session = await RecordingSession.create({
      board: boardId,
      workspace: workspaceId,
      createdBy: req.userId,
      title: title || "Untitled Recording",
      startedAt: new Date(),
      initialSnapshot,
      status: "recording",
    });
    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ message: "Failed to start recording", error: error.message });
  }
};

export const endRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await RecordingSession.findById(id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    session.endedAt = new Date();
    session.durationMs = calculateDuration(session.startedAt, session.endedAt);
    session.status = "completed";
    await session.save();

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: "Failed to end recording", error: error.message });
  }
};

export const saveEvents = async (req, res) => {
  try {
    const { id } = req.params;
    const { events } = req.body; 

    if (!Array.isArray(events)) {
      return res.status(400).json({ message: "Events must be an array" });
    }

    const session = await RecordingSession.findById(id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const formattedEvents = events.map(event => ({
      ...event,
      session: id,
      board: session.board,
    }));

    await RecordingEvent.insertMany(formattedEvents);
    res.status(201).json({ message: "Events saved successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to save events", error: error.message });
  }
};

export const uploadAudio = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ message: "No audio file uploaded" });

    const session = await RecordingSession.findById(id).populate("workspace");
    if (!session) return res.status(404).json({ message: "Session not found" });

    const workspace = session.workspace;
    if (!workspace || !workspace.googleDriveRefreshToken || !workspace.googleDriveFolderId) {
      // Fallback: save locally if Drive is not connected
      const audioUrl = `/recordings/${req.file.filename}`;
      session.audioUrl = audioUrl;
      session.audioMetadata = {
        mimeType: req.file.mimetype,
        size: req.file.size,
        storage: "local",
      };
      await session.save();
      return res.json({ message: "Audio uploaded locally (Drive not connected)", audioUrl });
    }

    // Upload to Google Drive
    const drive = getDriveClient(workspace.googleDriveRefreshToken);
    const FOLDER_ID = workspace.googleDriveFolderId;

    const fileMetadata = {
      name: `recording-audio-${id}.webm`,
      parents: [FOLDER_ID],
      appProperties: {
        workspaceId: workspace._id.toString(),
        recordingSessionId: id,
        type: "recording-audio",
      },
    };

    const media = {
      mimeType: req.file.mimetype,
      body: bufferToStream(req.file.buffer),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name",
    });

    const driveFileId = response.data.id;

    // Store the Drive file ID as the audio URL reference
    session.audioUrl = `drive://${driveFileId}`;
    session.audioMetadata = {
      mimeType: req.file.mimetype,
      size: req.file.size,
      storage: "drive",
      driveFileId: driveFileId,
    };
    await session.save();

    console.log(`[Recording] Audio uploaded to Drive: ${driveFileId}`);
    res.json({ message: "Audio uploaded to Google Drive", audioUrl: session.audioUrl, driveFileId });
  } catch (error) {
    console.error("Failed to upload audio:", error);
    res.status(500).json({ message: "Failed to upload audio", error: error.message });
  }
};

export const getRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await RecordingSession.findById(id)
      .populate("createdBy", "name email avatar")
      .populate("board", "title");
    
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch recording", error: error.message });
  }
};

export const getRecordingEvents = async (req, res) => {
  try {
    const { id } = req.params;
    const events = await RecordingEvent.find({ session: id }).sort({ timestampMs: 1, seq: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch events", error: error.message });
  }
};

export const listBoardRecordings = async (req, res) => {
  try {
    const { boardId } = req.params;
    const recordings = await RecordingSession.find({ board: boardId })
      .populate("createdBy", "name avatar")
      .sort({ startedAt: -1 });
    res.json(recordings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch board recordings", error: error.message });
  }
};

export const createCheckpoint = async (req, res) => {
  try {
    const { id } = req.params;
    const { timestampMs, elementsSnapshot, cameraSnapshot, isDark, bgMode } = req.body;

    await RecordingCheckpoint.create({
      session: id,
      timestampMs,
      elementsSnapshot,
      cameraSnapshot,
      isDark,
      bgMode,
    });

    res.status(201).json({ message: "Checkpoint created" });
  } catch (error) {
    res.status(500).json({ message: "Failed to create checkpoint", error: error.message });
  }
};
export const deleteRecording = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DeleteRecording] Attempting to delete session ${id}. Req.userId: ${req.userId}`);
    
    // We populate workspace to check for owner permission
    const session = await RecordingSession.findById(id).populate("workspace");
    
    if (!session) {
      console.error(`[DeleteRecording] Session ${id} not found.`);
      return res.status(404).json({ message: "Recording not found" });
    }

    console.log(`[DeleteRecording] Session found. CreatedBy: ${session.createdBy?.toString()}, WorkspaceOwner: ${session.workspace?.owner?.toString()}`);

    // Authorization check: Only creator or workspace owner
    const isCreator = session.createdBy.toString() === req.userId;
    const isWorkspaceOwner = session.workspace?.owner?.toString() === req.userId;

    if (!isCreator && !isWorkspaceOwner) {
      console.warn(`[DeleteRecording] Auth failed. Creator: ${session.createdBy.toString()}, WSOwner: ${session.workspace?.owner?.toString()}, Requester: ${req.userId}`);
      return res.status(403).json({ message: "Not authorized to delete this recording" });
    }

    // 1. Delete associated data
    console.log(`[DeleteRecording] Deleting associated events and checkpoints...`);
    await Promise.all([
      RecordingEvent.deleteMany({ session: id }),
      RecordingCheckpoint.deleteMany({ session: id })
    ]);

    // 2. Delete audio file if exists
    if (session.audioUrl) {
      console.log(`[DeleteRecording] Deleting audio: ${session.audioUrl}`);
      
      if (session.audioUrl.startsWith("drive://")) {
        // Audio is stored in Google Drive
        const driveFileId = session.audioUrl.replace("drive://", "");
        const workspace = session.workspace;
        if (workspace?.googleDriveRefreshToken) {
          try {
            const drive = getDriveClient(workspace.googleDriveRefreshToken);
            await drive.files.delete({ fileId: driveFileId });
            console.log(`[DeleteRecording] Deleted Drive audio file: ${driveFileId}`);
          } catch (driveErr) {
            console.error(`[DeleteRecording] Failed to delete Drive audio: ${driveErr.message}`);
          }
        }
      } else {
        // Audio is stored locally (legacy/fallback)
        const audioPath = path.join(process.cwd(), "uploads", "recordings", path.basename(session.audioUrl));
        if (fs.existsSync(audioPath)) {
          try {
            fs.unlinkSync(audioPath);
            console.log(`[DeleteRecording] Deleted local audio file at: ${audioPath}`);
          } catch (unlinkErr) {
            console.error(`[DeleteRecording] Failed to delete local audio file: ${unlinkErr.message}`);
          }
        } else {
          console.warn(`[DeleteRecording] Local audio file not found at: ${audioPath}`);
        }
      }
    }

    // 3. Delete session record
    console.log(`[DeleteRecording] Deleting session record...`);
    await RecordingSession.findByIdAndDelete(id);

    console.log(`[DeleteRecording] Successfully deleted session ${id}`);
    res.json({ message: "Recording deleted successfully" });
  } catch (error) {
    console.error(`[DeleteRecording] Error:`, error);
    res.status(500).json({ message: "Failed to delete recording", error: error.message });
  }
};

export const proxyRecordingAudio = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await RecordingSession.findById(id).populate("workspace");
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (!session.audioUrl) {
      return res.status(404).json({ message: "No audio for this recording" });
    }

    // Handle legacy local files
    if (!session.audioUrl.startsWith("drive://")) {
      const audioPath = path.join(process.cwd(), "uploads", "recordings", path.basename(session.audioUrl));
      if (!fs.existsSync(audioPath)) {
        return res.status(404).json({ message: "Local audio file not found" });
      }
      res.setHeader("Content-Type", session.audioMetadata?.mimeType || "audio/webm");
      return fs.createReadStream(audioPath).pipe(res);
    }

    // Drive-stored audio
    const driveFileId = session.audioUrl.replace("drive://", "");
    const workspace = session.workspace;

    if (!workspace?.googleDriveRefreshToken) {
      return res.status(400).json({ message: "Workspace Drive not configured" });
    }

    const drive = getDriveClient(workspace.googleDriveRefreshToken);

    const downloadResponse = await drive.files.get(
      { fileId: driveFileId, alt: "media" },
      { responseType: "stream" }
    );

    res.setHeader("Content-Type", session.audioMetadata?.mimeType || "audio/webm");
    res.setHeader("Cache-Control", "public, max-age=86400"); // cache for 24 hours

    downloadResponse.data
      .on("error", (err) => {
        console.error("[ProxyAudio] Stream error:", err);
        if (!res.headersSent) res.status(500).end();
      })
      .pipe(res);
  } catch (error) {
    console.error("[ProxyAudio] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to stream audio", error: error.message });
    }
  }
};
