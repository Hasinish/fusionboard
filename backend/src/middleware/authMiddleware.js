import jwt from "jsonwebtoken";
import User from "../models/User.js";

export function authMiddleware(req, res, next) {
  let token = req.query.token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }
  }

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;

    // blindly update their active status so we don't hold up the request
    User.findByIdAndUpdate(decoded.id, { lastActive: new Date() }).catch(
      () => { }
    );

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
