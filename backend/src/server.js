// backend/src/server.js
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import boardRoutes from "./routes/boardRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

import Message from "./models/Message.js";
import Board from "./models/Board.js";
import Workspace from "./models/Workspace.js";
import User from "./models/User.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

// routes
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces", chatRoutes); // adds /api/workspaces/:id/messages
app.use("/api/invitations", invitationRoutes);
app.use("/api/boards", boardRoutes);

// --- Socket.io setup ---
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Authenticate sockets using JWT (used by chat + boards)
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id; // available in all socket handlers
    return next();
  } catch {
    return next(new Error("Invalid token"));
  }
});

// simple deterministic color assignment
const CURSOR_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

function pickColor(key) {
  const s = String(key || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

// track socket -> { boardId, userId, name, color }
const socketMeta = new Map();

io.on("connection", (socket) => {
  // -------------------------
  // WORKSPACE CHAT
  // -------------------------
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

  // -------------------------
  // WHITEBOARD JOIN
  // -------------------------
  socket.on("joinBoard", ({ boardId, user }) => {
    if (!boardId) return;

    const name = user?.name ? String(user.name) : "User";
    const userId = socket.userId; // stable per account (from JWT)
    const color = pickColor(userId);

    socket.join(boardId);
    socketMeta.set(socket.id, { boardId, userId, name, color });

    socket.to(boardId).emit("cursorJoin", { userId, name, color });
  });

  // draw + autosave
  socket.on("draw", async ({ boardId, segment }) => {
    if (!boardId || !segment) return;

    socket.to(boardId).emit("draw", segment);

    try {
      const updated = await Board.findByIdAndUpdate(
        boardId,
        { $push: { segments: segment } },
        { new: true }
      ).select("updatedAt");

      if (updated) {
        io.to(boardId).emit("saved", { updatedAt: updated.updatedAt });
      }
    } catch (e) {
      console.error("clearBoard error:", e);
    }
  });

  // live cursor broadcast
  socket.on("cursorMove", ({ boardId, x, y }) => {
    if (!boardId) return;

    const meta = socketMeta.get(socket.id);
    if (!meta) return;

    socket.to(boardId).emit("cursorMove", {
      userId: meta.userId,
      name: meta.name,
      color: meta.color,
      x,
      y,
    });
  });

  // clear board for everyone + DB
  socket.on("clearBoard", async ({ boardId }) => {
    if (!boardId) return;

    try {
      await Board.findByIdAndUpdate(boardId, { $set: { segments: [] } });
      io.to(boardId).emit("cleared");
      io.to(boardId).emit("saved", { updatedAt: new Date().toISOString() });
    } catch (e) {
      console.error("voice:leave error:", e);
      if (ack) ack({ ok: false, message: "Voice leave failed" });
    }
  });

  socket.on("cursorLeave", ({ boardId }) => {
    const meta = socketMeta.get(socket.id);
    if (!meta || !boardId) return;
    socket.to(boardId).emit("cursorLeave", { userId: meta.userId });
  });

  socket.on("disconnect", () => {
    const meta = socketMeta.get(socket.id);
    if (meta?.boardId) {
      socket.to(meta.boardId).emit("cursorLeave", { userId: meta.userId });
    }
    socketMeta.delete(socket.id);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
