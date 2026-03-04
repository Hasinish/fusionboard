import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library"; // [NEW] Import Google Library

// set up the google login helper
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    // see if they already signed up
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already used" });

    // scramble their password
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

    // if they used google before, make them use it again
    if (!user.password) {
      return res.status(400).json({ message: "Please sign in with Google" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    // spin up a login token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    // ship back the token and their basic profile
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      },
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
}

// Google Login Logic
export async function googleLogin(req, res) {
  try {
    const { credential } = req.body;

    // make sure the token from the frontend is legit
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload;

    // see if we know this person
    let user = await User.findOne({ email });

    if (!user) {
      // register them (google handles the password)
      user = await User.create({
        name,
        email,
        googleId,
        avatar: picture,
      });
    } else {
      // tie their existing account to their google login
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.avatar) user.avatar = picture;
        await user.save();
      }
    }

    // mint a fresh local token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (e) {
    console.error("Google Auth Error:", e);
    res.status(400).json({ message: "Google authentication failed" });
  }
}

// let them change their profile info
export async function updateMe(req, res) {
  try {
    const userId = req.userId;
    const { name, email } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // make sure nobody else claimed this email
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
        avatar: user.avatar,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
}

export async function getMe(req, res) {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    });
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
}
