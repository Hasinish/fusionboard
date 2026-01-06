import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
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
import driveRoutes from "./routes/driveRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";

import { ensureMember } from "./controllers/chatController.js";
import Message from "./models/Message.js";
import Board from "./models/Board.js";
import User from "./models/User.js";
import Workspace from "./models/Workspace.js";
import Notification from "./models/Notification.js";
import Activity from "./models/Activity.js";

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
  throw new Error("DB connect function not found.");
}
connect();

// [UPDATED] ALLOWED ORIGINS (CORS)
const allowedOrigins = [
  "http://localhost:5173", // Local development
  process.env.FRONTEND_URL, // This will be your Vercel URL
  "https://fusionboard.vercel.app" // Backup fallback
];

app.use(
  cors({
    origin: allowedOrigins,
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
app.use("/api/drive", driveRoutes);
app.use("/api/activities", activityRoutes);

// ---- socket server ----
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // [UPDATED] Use same allowed origins
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
      return { 
        peerId: sid, 
        name: s.userName || "Unknown",
        isMuted: !!s.isMuted 
      };
    })
    .filter(Boolean);
  io.to(roomId).emit("voice:participants:update", { participants });
}

io.on("connection", (socket) => {
  // VOICE ROOMS
  socket.on("voice:join", ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
    socket.isMuted = false; 
    broadcastParticipants(roomId);
    socket.to(roomId).emit("voice:peer-joined", {
      peerId: socket.id,
      name: socket.userName || "Unknown",
    });
  });

  socket.on("voice:mute-change", ({ roomId, isMuted }) => {
    socket.isMuted = isMuted; 
    broadcastParticipants(roomId); 
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
      socket.to(roomId).emit("voice:peer-left", {
        peerId: socket.id,
        name: socket.userName || "Unknown",
      });
      const room = io.sockets.adapter.rooms.get(roomId);
      const socketIds = room ? Array.from(room) : [];
      const participants = socketIds
        .filter(sid => sid !== socket.id)
        .map((sid) => {
            const s = io.sockets.sockets.get(sid);
            if (!s) return null;
            return { 
                peerId: sid, 
                name: s.userName || "Unknown",
                isMuted: !!s.isMuted 
            };
        })
        .filter(Boolean);
      io.to(roomId).emit("voice:participants:update", { participants });
    }
  });

  // WORKSPACE CHAT
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
      const ws = await Workspace.findById(workspaceId).select("name members");
      if (ws && ws.members) {
        const recipients = ws.members
          .filter((m) => String(m.user) !== String(socket.userId))
          .map((m) => m.user);
        const operations = recipients.map((recipientId) => ({
          updateOne: {
            filter: { recipient: recipientId, workspace: workspaceId, type: "message" },
            update: { $set: { text: `You have new messages in ${ws.name}`, isRead: false } },
            upsert: true,
          },
        }));
        if (operations.length > 0) {
          await Notification.bulkWrite(operations);
        }
      }
      await Activity.create({
        workspace: workspaceId,
        user: socket.userId,
        action: "sent_message",
        details: clean.substring(0, 50) + (clean.length > 50 ? "..." : ""),
      });
      if (ack) ack({ ok: true });
    } catch (e) {
      console.error("chat:send error:", e);
      if (ack) ack({ ok: false, message: "Send failed" });
    }
  });

  // WHITEBOARD
  socket.on("joinBoard", async ({ boardId, user }) => {
    if (!boardId) return;
    const name = user?.name ? String(user.name) : socket.userName || "User";
    const userId = socket.userId;
    const color = pickColor(userId);
    let workspaceId = null;
    let boardTitle = "Unknown Board";
    try {
        const board = await Board.findById(boardId).select("workspace title");
        if (board) {
            workspaceId = board.workspace;
            boardTitle = board.title;
        }
    } catch (e) { /* ignore */ }
    socket.join(`board:${boardId}`);
    socketMeta.set(socket.id, { 
        boardId, userId, name, color, 
        workspaceId, boardTitle, hasEdited: false 
    });
    socket.to(`board:${boardId}`).emit("cursorJoin", { userId, name, color });
  });

  socket.on("draw", async ({ boardId, segment }) => {
    if (!boardId || !segment) return;
    const meta = socketMeta.get(socket.id);
    if (meta) meta.hasEdited = true;
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
      const meta = socketMeta.get(socket.id);
      if (meta) meta.hasEdited = true;
      await Board.findByIdAndUpdate(boardId, { $set: { segments: [] } });
      io.to(`board:${boardId}`).emit("cleared");
      io.to(`board:${boardId}`).emit("saved", {
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("clearBoard error:", e);
    }
  });

  const leaveCursor = async () => {
    const meta = socketMeta.get(socket.id);
    if (!meta) return;
    if (meta.boardId) {
        socket.to(`board:${meta.boardId}`).emit("cursorLeave", { userId: meta.userId });
    }
    if (meta.hasEdited && meta.workspaceId) {
        try {
            await Activity.create({
                workspace: meta.workspaceId,
                user: meta.userId,
                action: "edited_board",
                details: meta.boardTitle,
            });
        } catch (e) { console.error("Failed to log board edit", e); }
    }
    socketMeta.delete(socket.id);
  };

  socket.on("cursorLeave", leaveCursor);
  socket.on("disconnect", leaveCursor);
});

server.listen(PORT, () => {
  console.log(`Server started on PORT: ${PORT}`);
});