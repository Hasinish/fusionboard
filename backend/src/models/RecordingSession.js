import mongoose from "mongoose";

const recordingSessionSchema = new mongoose.Schema(
  {
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, default: "Untitled Recording" },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    durationMs: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["recording", "completed", "failed"],
      default: "recording",
    },
    audioUrl: { type: String }, // URL or file path to the audio recording
    audioMetadata: {
      mimeType: String,
      size: Number,
    },
    initialSnapshot: {
      elements: { type: Array, default: [] },
      camera: {
        x: Number,
        y: Number,
        z: Number,
      },
      isDark: { type: Boolean },
      bgMode: { type: String },
    },
    thumbnailUrl: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("RecordingSession", recordingSessionSchema);
