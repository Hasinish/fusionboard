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
      enum: ["message", "board", "join"], // added join for invites
      default: "message",
    },
    text: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// don't spam users with duplicate notifs per workspace
notificationSchema.index({ recipient: 1, workspace: 1, type: 1 }, { unique: true });

export default mongoose.model("Notification", notificationSchema);