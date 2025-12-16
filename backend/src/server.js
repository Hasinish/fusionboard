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
import boardRoutes from "./routes/boardRoutes.js";

import { connectDB } from "./config/db.js";

import User from "./models/User.js";

import Message from "./models/Message.js";
import Board from "./models/Board.js";
import { ensureMember } from "./controllers/chatController.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

connectDB();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces", chatRoutes); // adds /api/workspaces/:id/messages
app.use("/api/invitations", invitationRoutes);
app.use("/api/boards", boardRoutes);

// --- Socket.io setup ---
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Authenticate sockets using JWT (used by chat + boards)
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id; // available in all socket handlers
    return next();
  } catch (e) {
    return next(new Error("Invalid token"));
  }
});

// simple deterministic color assignment
const CURSOR_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

function pickColor(key) {
  if (!key) return CURSOR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < String(key).length; i++) {
    hash = (hash * 31 + String(key).charCodeAt(i)) >>> 0;
  }
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

// track socket -> { boardId, userId, name, color }
const socketMeta = new Map();

io.on("connection", (socket) => {
  // =========================
  // Workspace Chat (textchat)
  // =========================

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

  // =========================
  // Boards (main)
  // =========================

  socket.on("joinBoard", ({ boardId, user }) => {
    if (!boardId) return;

    // Prefer authenticated id from JWT; fallback to user payload/socket.id
    const userId = socket.userId || user?.id || socket.id;
    const name = user?.name || "User";
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
      console.error("Autosave error:", e?.message || e);
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
      console.error("Clear board error:", e?.message || e);
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


const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket auth middleware (JWT) + load user name
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("name email").lean();
    if (!user) return next(new Error("User not found"));

    socket.userId = decoded.id;
    socket.userName = user.name;

    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

// Helper: broadcast full participants list to everyone in a room
function broadcastParticipants(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  const participantIds = room ? Array.from(room) : [];

  const participants = participantIds
    .map((sid) => {
      const s = io.sockets.sockets.get(sid);
      if (!s) return null;
      return { peerId: sid, name: s.userName || "Unknown" };
    })
    .filter(Boolean);

  io.to(roomId).emit("voice:participants:update", { participants });
}

io.on("connection", (socket) => {
  socket.on("voice:join", ({ roomId }) => {
    if (!roomId) return;

    socket.join(roomId);

    // Send full list to the joiner immediately (initial)
    broadcastParticipants(roomId);

    // Optional “toast” event
    socket.to(roomId).emit("voice:peer-joined", {
      peerId: socket.id,
      name: socket.userName || "Unknown",
    });
  });

  socket.on("voice:signal", ({ to, data }) => {
    if (!to) return;
    io.to(to).emit("voice:signal", { from: socket.id, data });
  });

  socket.on("voice:leave", ({ roomId }) => {
    if (!roomId) return;

    socket.leave(roomId);

    // Update list for everyone after leaving
    broadcastParticipants(roomId);

    socket.to(roomId).emit("voice:peer-left", {
      peerId: socket.id,
      name: socket.userName || "Unknown",
    });
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;

      // After this socket disconnects, list will change — broadcast update
      // But "disconnecting" fires before it actually leaves rooms; so do a tiny delay.
      setTimeout(() => broadcastParticipants(roomId), 0);

      socket.to(roomId).emit("voice:peer-left", {
        peerId: socket.id,
        name: socket.userName || "Unknown",
      });
    }
  });
});


server.listen(PORT, () => {
  console.log("Server started on PORT:", PORT);
});
