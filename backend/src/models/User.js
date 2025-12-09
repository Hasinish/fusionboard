import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hashed password
  lastActive: { type: Date, default: null },  // for online/offline status
});

export default mongoose.model("User", userSchema);
