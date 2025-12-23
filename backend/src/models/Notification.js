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
      enum: ["message"], // can expand later
      default: "message",
    },
    text: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Ensure a user only has one notification entry per workspace for messages
notificationSchema.index({ recipient: 1, workspace: 1, type: 1 }, { unique: true });

export default mongoose.model("Notification", notificationSchema);