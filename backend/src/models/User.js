import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },
  avatar: { type: String },
  contact: { type: String, default: "" },
  bio: { type: String, default: "" },
  lastActive: { type: Date, default: null },
});

export default mongoose.model("User", userSchema);