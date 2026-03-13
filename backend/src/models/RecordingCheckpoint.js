import mongoose from "mongoose";

const recordingCheckpointSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecordingSession",
      required: true,
      index: true,
    },
    timestampMs: { type: Number, required: true, index: true },
    elementsSnapshot: { type: Array, required: true },
    cameraSnapshot: {
      x: Number,
      y: Number,
      z: Number,
    },
    isDark: { type: Boolean },
    bgMode: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("RecordingCheckpoint", recordingCheckpointSchema);
