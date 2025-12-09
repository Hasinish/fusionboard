import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    // Check existing user
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already used" });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    await User.create({ name, email, password: hashed });

    res.json({ message: "Registered successfully" });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    // Send token + basic user info
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
}

// UPDATE LOGGED-IN USER PROFILE
export async function updateMe(req, res) {
  try {
    const userId = req.userId;
    const { name, email } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // If email is changed, check uniqueness
    if (email && email !== user.email) {
      const exists = await User.findOne({ email });
      if (exists) {
        return res.status(400).json({ message: "Email already used" });
      }
      user.email = email;
    }

    if (name) {
      user.name = name;
    }

    await user.save();

    return res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
}
