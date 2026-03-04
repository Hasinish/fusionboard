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

    // Current owner (there can be only one)
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Members (including owner) with roles
    members: [memberSchema],

    // Google Drive Configuration (for the owner)
    googleDriveRefreshToken: { type: String },
    googleDriveFolderId: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Workspace", workspaceSchema);
