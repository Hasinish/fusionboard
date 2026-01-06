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

const boardVersionSchema = new mongoose.Schema(
  {
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    // We store the exact state of segments at this point in time
    segments: { type: [segmentSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("BoardVersion", boardVersionSchema);