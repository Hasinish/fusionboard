// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import * as dbModule from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import invitationRoutes from "./routes/invitationRoutes.js";
import boardRoutes from "./routes/boardRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import userRoutes from "./routes/userRoutes.js";

import { ensureMember } from "./controllers/chatController.js";
import Message from "./models/Message.js";
import Board from "./models/Board.js";
import User from "./models/User.js";
import Workspace from "./models/Workspace.js";
import Notification from "./models/Notification.js";
import driveRoutes from "./routes/driveRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001;

// ---- DB connect ----
const connect =
  typeof dbModule.default === "function"
    ? dbModule.default
    : typeof dbModule.connectDB === "function"
      ? dbModule.connectDB
      : null;

if (!connect) {
  throw new Error(
    "DB connect function not found. Check src/config/db.js export."
  );
}
connect();

// ---- middleware ----
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

// ---- routes ----
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces", chatRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes); 
app.use("/api/boards", boardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userRoutes); 
app.use("/api/drive", driveRoutes);

// ---- socket server ----
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket auth middleware
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = String(decoded.id);

    const user = await User.findById(userId).select("name email").lean();
    if (!user) return next(new Error("User not found"));

    socket.userId = userId;
    socket.userName = user.name || "Unknown";

    return next();
  } catch {
    return next(new Error("Invalid token"));
  }
});

// WHITEBOARD cursor colors
const CURSOR_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];
function pickColor(key) {
  const s = String(key || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

const socketMeta = new Map();

function broadcastParticipants(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  const socketIds = room ? Array.from(room) : [];
  const participants = socketIds
    .map((sid) => {
      const s = io.sockets.sockets.get(sid);
      if (!s) return null;
      return { peerId: sid, name: s.userName || "Unknown" };
    })
    .filter(Boolean);
  io.to(roomId).emit("voice:participants:update", { participants });
}

io.on("connection", (socket) => {
  // =========================
  // VOICE ROOMS
  // =========================
  socket.on("voice:join", ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
    broadcastParticipants(roomId);
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
    broadcastParticipants(roomId);
    socket.to(roomId).emit("voice:peer-left", {
      peerId: socket.id,
      name: socket.userName || "Unknown",
    });
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      setTimeout(() => broadcastParticipants(roomId), 0);
      socket.to(roomId).emit("voice:peer-left", {
        peerId: socket.id,
        name: socket.userName || "Unknown",
      });
    }
  });

  // =========================
  // WORKSPACE CHAT
  // =========================
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

      // 1. Save Message
      const msg = await Message.create({
        workspace: workspaceId,
        sender: socket.userId,
        text: clean,
      });

      const full = await Message.findById(msg._id)
        .populate("sender", "name email")
        .lean();

      // 2. Broadcast to room
      io.to(`ws:${workspaceId}`).emit("chat:new", full);

      // 3. Create Notifications for ALL members (except sender)
      const ws = await Workspace.findById(workspaceId).select("name members");
      if (ws && ws.members) {
        const recipients = ws.members
          .filter((m) => String(m.user) !== String(socket.userId))
          .map((m) => m.user);

        const operations = recipients.map((recipientId) => ({
          updateOne: {
            filter: {
              recipient: recipientId,
              workspace: workspaceId,
              type: "message",
            },
            update: {
              $set: {
                text: `You have new messages in ${ws.name}`,
                isRead: false,
              },
            },
            upsert: true,
          },
        }));

        if (operations.length > 0) {
          await Notification.bulkWrite(operations);
        }
      }

      if (ack) ack({ ok: true });
    } catch (e) {
      console.error("chat:send error:", e);
      if (ack) ack({ ok: false, message: "Send failed" });
    }
  });

  // =========================
  // WHITEBOARD
  // =========================
  socket.on("joinBoard", ({ boardId, user }) => {
    if (!boardId) return;
    const name = user?.name ? String(user.name) : socket.userName || "User";
    const userId = socket.userId;
    const color = pickColor(userId);
    socket.join(`board:${boardId}`);
    socketMeta.set(socket.id, { boardId, userId, name, color });
    socket.to(`board:${boardId}`).emit("cursorJoin", { userId, name, color });
  });

  socket.on("draw", async ({ boardId, segment }) => {
    if (!boardId || !segment) return;
    socket.to(`board:${boardId}`).emit("draw", segment);
    try {
      const updated = await Board.findByIdAndUpdate(
        boardId,
        { $push: { segments: segment } },
        { new: true }
      ).select("updatedAt");
      if (updated) {
        io.to(`board:${boardId}`).emit("saved", { updatedAt: updated.updatedAt });
      }
    } catch (e) {
      console.error("autosave error:", e);
    }
  });

  socket.on("cursorMove", ({ boardId, x, y }) => {
    if (!boardId) return;
    const meta = socketMeta.get(socket.id);
    if (!meta) return;
    if (String(meta.boardId) !== String(boardId)) return;
    socket.to(`board:${boardId}`).emit("cursorMove", {
      userId: meta.userId,
      name: meta.name,
      color: meta.color,
      x,
      y,
    });
  });

  socket.on("clearBoard", async ({ boardId }) => {
    if (!boardId) return;
    try {
      await Board.findByIdAndUpdate(boardId, { $set: { segments: [] } });
      io.to(`board:${boardId}`).emit("cleared");
      io.to(`board:${boardId}`).emit("saved", {
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("clearBoard error:", e);
    }
  });

  const leaveCursor = () => {
    const meta = socketMeta.get(socket.id);
    if (!meta?.boardId) return;
    socket.to(`board:${meta.boardId}`).emit("cursorLeave", { userId: meta.userId });
    socketMeta.delete(socket.id);
  };

  socket.on("cursorLeave", leaveCursor);
  socket.on("disconnect", leaveCursor);
});

server.listen(PORT, () => {
  console.log(`Server started on PORT: ${PORT}`);
});