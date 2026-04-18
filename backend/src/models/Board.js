import mongoose from "mongoose";

// Elements: sticky notes, rect, ellipse, triangle, arrow, text, path, code, video
const elementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ["sticky", "rect", "ellipse", "triangle", "arrow", "text", "path", "code", "video", "graph"],
      required: true
    },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    w: { type: Number, default: 200 },
    h: { type: Number, default: 150 },
    rotation: { type: Number, default: 0 },
    fill: { type: String, default: "#fef08a" },
    stroke: { type: String, default: "#e2c94e" },
    strokeWidth: { type: Number, default: 2 },
    text: { type: String, default: "" },
    textAlign: { type: String, default: "left" },
    fontFamily: { type: String, default: "Inter" },
    fontSize: { type: Number, default: 14 },
    bold: { type: Boolean, default: false },
    italic: { type: Boolean, default: false },
    textColor: { type: String, default: "#1e1e1e" },
    textVerticalAlign: { type: String, enum: ["top", "middle", "bottom"], default: "top" },

    // Path element specific
    points: { type: [{ x: Number, y: Number, pressure: Number }], default: undefined },

    // Video element specific
    url: { type: String },
    videoId: { type: String },

    // Code element specific
    code: { type: String },
    output: { type: String },
    language: { type: String },

    // General styling/state overrides
    color: { type: String },
    width: { type: Number },
    isMarkedForErasure: { type: Boolean, default: false },
  },
  { _id: false, strict: false }
);

const boardSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    title: { type: String, default: "Untitled Board" },
    // Legacy bootstrap storage. Do not load normally. Yjs persistence uses LevelDB.
    elements: { type: [elementSchema], default: [], select: false },
  },
  { timestamps: true }
);

export default mongoose.model("Board", boardSchema);
