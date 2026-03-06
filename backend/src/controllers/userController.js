import User from "../models/User.js";

export async function getAllUsers(req, res) {
  try {
    const { q } = req.query;
    let query = {};
    if (q) {
      query = {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
        ],
      };
    }
    const users = await User.find(query, "name email").limit(10).lean();
    return res.json(users);
  } catch (e) {
    console.error("getAllUsers error:", e);
    return res.status(500).json({ message: "Server error" });
  }
}