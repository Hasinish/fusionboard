import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "created_board",
        "deleted_board",
        "edited_board",
        "renamed_board",
        "uploaded_file",
        "deleted_file",
        "sent_message",
      ],
      required: true,
    },
    details: {
      type: String, // extra info like filename or message snippet
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Activity", activitySchema);