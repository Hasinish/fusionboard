import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import invitationRoutes from "./routes/invitationRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

import { connectDB } from "./config/db.js";
import Message from "./models/Message.js";
import { ensureMember } from "./controllers/chatController.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

connectDB();

// middleware
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);
app.use(express.json());

// routes
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces", chatRoutes); // adds /api/workspaces/:id/messages
app.use("/api/invitations", invitationRoutes);

// --- Socket.io setup ---
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Authenticate sockets using JWT
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    return next();
  } catch (e) {
    return next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  // Join a workspace room
  socket.on("workspace:join", async ({ workspaceId }, ack) => {
    try {
      const check = await ensureMember(workspaceId, socket.userId);
      if (!check.ok) {
        if (ack) ack({ ok: false, message: check.message });
        return;
      }
      socket.join(`ws:${workspaceId}`);
      if (ack) ack({ ok: true });
    } catch {
      if (ack) ack({ ok: false, message: "Join failed" });
    }
  });

  // Send message to workspace
  socket.on("chat:send", async ({ workspaceId, text }, ack) => {
    try {
      const clean = String(text || "").trim();
      if (!clean) {
        if (ack) ack({ ok: false, message: "Empty message" });
        return;
      }

      const check = await ensureMember(workspaceId, socket.userId);
      if (!check.ok) {
        if (ack) ack({ ok: false, message: check.message });
        return;
      }

      const msg = await Message.create({
        workspace: workspaceId,
        sender: socket.userId,
        text: clean,
      });

      const full = await Message.findById(msg._id)
        .populate("sender", "name email")
        .lean();

      io.to(`ws:${workspaceId}`).emit("chat:new", full);

      if (ack) ack({ ok: true });
    } catch (e) {
      console.error("chat:send error:", e);
      if (ack) ack({ ok: false, message: "Send failed" });
    }
  });
});

// start server
server.listen(PORT, () => {
  console.log("Server started on PORT:", PORT);
});
