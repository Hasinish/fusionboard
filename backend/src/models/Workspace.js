// backend/src/models/Workspace.js
import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "editor", "viewer"],
      default: "viewer",
    },
  },
  { _id: false }
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },

    // the big boss (only 1 allowed)
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // everyone in the workspace plus their perms
    members: [memberSchema],

    // gdrive settings (owner only)
    googleDriveRefreshToken: { type: String },
    googleDriveFolderId: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Workspace", workspaceSchema);
