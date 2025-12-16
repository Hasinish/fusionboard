import mongoose from "mongoose";

const segmentSchema = new mongoose.Schema(
  {
    x0: Number,
    y0: Number,
    x1: Number,
    y1: Number,
    color: { type: String, default: "#000000" },
    width: { type: Number, default: 2 },
  },
  { _id: false }
);

const boardSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    title: { type: String, default: "Untitled Board" },
    segments: { type: [segmentSchema], default: [] }, // saved state
  },
  { timestamps: true }
);

export default mongoose.model("Board", boardSchema);
