import RecordingSession from "../models/RecordingSession.js";
import RecordingEvent from "../models/RecordingEvent.js";
import RecordingCheckpoint from "../models/RecordingCheckpoint.js";
import fs from "fs";
import path from "path";

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

    const session = await RecordingSession.findById(id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    // Use forward slashes for URLs
    const audioUrl = `/recordings/${req.file.filename}`;
    session.audioUrl = audioUrl;
    session.audioMetadata = {
      mimeType: req.file.mimetype,
      size: req.file.size,
    };
    await session.save();

    res.json({ message: "Audio uploaded successfully", audioUrl });
  } catch (error) {
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
      console.log(`[DeleteRecording] Deleting audio file: ${session.audioUrl}`);
      const audioPath = path.join(process.cwd(), "uploads", "recordings", path.basename(session.audioUrl));
      if (fs.existsSync(audioPath)) {
        try {
          fs.unlinkSync(audioPath);
          console.log(`[DeleteRecording] Deleted audio file at: ${audioPath}`);
        } catch (unlinkErr) {
          console.error(`[DeleteRecording] Failed to delete audio file: ${unlinkErr.message}`);
        }
      } else {
        console.warn(`[DeleteRecording] Audio file not found at: ${audioPath}`);
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
