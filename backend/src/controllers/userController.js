import User from "../models/User.js";

export async function getAllUsers(req, res) {
  try {
    // Return id, name, email for listing
    const users = await User.find({}, "name email").lean();
    return res.json(users);
  } catch (e) {
    console.error("getAllUsers error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}