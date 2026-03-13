import mongoose from "mongoose";

const recordingEventSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecordingSession",
      required: true,
      index: true,
    },
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
    },
    actorUserId: { type: String, required: true }, // Store as string ID for flexibility (e.g. guest users)
    timestampMs: { type: Number, required: true, index: true }, // Milliseconds relative to recording start
    seq: { type: Number, required: true }, // Sequence number for deterministic order if timestamps are identical
    type: {
      type: String,
      required: true,
    },
    targetElementId: { type: String },
    payload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Compound index for efficient event retrieval in order
recordingEventSchema.index({ session: 1, timestampMs: 1, seq: 1 });

export default mongoose.model("RecordingEvent", recordingEventSchema);
