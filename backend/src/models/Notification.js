import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    type: {
      type: String,
      enum: ["message", "board"], // [UPDATED] Added "board"
      default: "message",
    },
    text: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Ensure a user only has one notification entry per workspace per type
// e.g. One "You have new messages" and One "New board created" max per workspace
notificationSchema.index({ recipient: 1, workspace: 1, type: 1 }, { unique: true });

export default mongoose.model("Notification", notificationSchema);