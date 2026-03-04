import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: { type: String, required: true }, // holds the raw html content
  },
  { timestamps: true }
);

export default mongoose.model("Note", noteSchema);