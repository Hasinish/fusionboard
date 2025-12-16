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

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/boards", boardRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// -------------------------
// Auth middleware for sockets (JWT)
// -------------------------
io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = String(decoded.id);

    // Fetch user name (used by voice participants list)
    try {
      const u = await User.findById(socket.userId).select("name").lean();
      socket.userName = u?.name ? String(u.name) : "User";
    } catch {
      socket.userName = "User";
    }

    return next();
  } catch {
    return next(new Error("Invalid token"));
  }
});

// -------------------------
// Helpers
// -------------------------
async function ensureMember(workspaceId, userId) {
  try {
    const ws = await Workspace.findById(workspaceId).select("owner members").lean();
    if (!ws) return { ok: false, message: "Workspace not found" };

    const uid = String(userId);
    const ownerOk = ws.owner && String(ws.owner) === uid;
    const memberOk = Array.isArray(ws.members) && ws.members.some((m) => String(m) === uid);

    if (!ownerOk && !memberOk) {
      return { ok: false, message: "Not a member of this workspace" };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: "Membership check failed" };
  }
}

// ---------- LIVE CURSOR helpers ----------
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

// socket.id -> { boardId, userId, name, color }
const cursorState = new Map();

// ---------- VOICE helpers ----------
const voiceRoomKey = (roomId) => `voice:${roomId}`;

async function emitVoiceParticipants(roomKey) {
  // fetchSockets gives all sockets currently in the room
  const sockets = await io.in(roomKey).fetchSockets();

  const participants = sockets.map((s) => ({
    peerId: s.id,
    name: s.userName || "User",
  }));

  // Main event your frontend expects
  io.to(roomKey).emit("voice:participants:update", { participants });

  // Backward compat (harmless if unused)
  io.to(roomKey).emit("voice:participants", { participants });
}

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

    cursorState.set(socket.id, { boardId, userId, name, color });

    socket.join(`board:${boardId}`);

    // tell others this user joined (cursor exists)
    socket.to(`board:${boardId}`).emit("cursorJoin", { userId, name, color });
  });

  // -------------------------
  // WHITEBOARD DRAW + AUTOSAVE
  // -------------------------
  socket.on("draw", async ({ boardId, strokes }) => {
    try {
      if (!boardId) return;
      socket.to(`board:${boardId}`).emit("draw", strokes);

      // autosave
      await Board.findByIdAndUpdate(boardId, { strokes }, { new: false });
    } catch (e) {
      console.error("draw error:", e);
    }
  });

  socket.on("clearBoard", async ({ boardId }) => {
    try {
      if (!boardId) return;
      socket.to(`board:${boardId}`).emit("clearBoard");
      await Board.findByIdAndUpdate(boardId, { strokes: [] }, { new: false });
    } catch (e) {
      console.error("clearBoard error:", e);
    }
  });

  // -------------------------
  // LIVE CURSOR MOVE
  // -------------------------
  socket.on("cursorMove", ({ boardId, x, y }) => {
    const st = cursorState.get(socket.id);
    if (!st || st.boardId !== boardId) return;

    socket.to(`board:${boardId}`).emit("cursorMove", {
      userId: st.userId,
      x,
      y,
    });
  });

  // -------------------------
  // WHITEBOARD LEAVE (cursor)
  // -------------------------
  function leaveCursor() {
    const st = cursorState.get(socket.id);
    if (!st) return;
    cursorState.delete(socket.id);

    socket.to(`board:${st.boardId}`).emit("cursorLeave", {
      userId: st.userId,
    });
  }

  socket.on("leaveBoard", () => {
    leaveCursor();
  });

  // -------------------------
  // ✅ VOICE CHAT (WebRTC signaling)
  // -------------------------
  socket.on("voice:join", async ({ roomId }, ack) => {
    try {
      if (!roomId) {
        if (ack) ack({ ok: false, message: "Missing roomId" });
        return;
      }

      // roomId is your workspace id
      const check = await ensureMember(roomId, socket.userId);
      if (!check.ok) {
        if (ack) ack({ ok: false, message: check.message });
        return;
      }

      const roomKey = voiceRoomKey(roomId);

      // remember joined rooms (for disconnect cleanup)
      if (!socket.data.voiceRooms) socket.data.voiceRooms = new Set();
      socket.data.voiceRooms.add(roomKey);

      socket.join(roomKey);

      // optional: tell others someone joined
      socket.to(roomKey).emit("voice:peer-joined", { peerId: socket.id });

      await emitVoiceParticipants(roomKey);

      if (ack) ack({ ok: true });
    } catch (e) {
      console.error("voice:join error:", e);
      if (ack) ack({ ok: false, message: "Voice join failed" });
    }
  });

  socket.on("voice:leave", async ({ roomId }, ack) => {
    try {
      if (!roomId) {
        if (ack) ack({ ok: false, message: "Missing roomId" });
        return;
      }

      const roomKey = voiceRoomKey(roomId);

      socket.leave(roomKey);

      if (socket.data.voiceRooms) socket.data.voiceRooms.delete(roomKey);

      socket.to(roomKey).emit("voice:peer-left", { peerId: socket.id });

      await emitVoiceParticipants(roomKey);

      if (ack) ack({ ok: true });
    } catch (e) {
      console.error("voice:leave error:", e);
      if (ack) ack({ ok: false, message: "Voice leave failed" });
    }
  });

  socket.on("voice:signal", ({ to, data }) => {
    // Forward signaling messages to the target peer (offer/answer/ice)
    if (!to) return;
    io.to(to).emit("voice:signal", { from: socket.id, data });
  });

  // -------------------------
  // DISCONNECT (keep ALL features)
  // -------------------------
  socket.on("disconnect", async () => {
    // 1) cursor cleanup
    leaveCursor();

    // 2) voice cleanup + participants update
    try {
      const rooms = socket.data.voiceRooms ? Array.from(socket.data.voiceRooms) : [];
      for (const roomKey of rooms) {
        // let others remove this peer
        socket.to(roomKey).emit("voice:peer-left", { peerId: socket.id });
        await emitVoiceParticipants(roomKey);
      }
    } catch (e) {
      console.error("voice disconnect cleanup error:", e);
    }
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
