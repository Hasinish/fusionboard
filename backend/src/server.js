import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import invitationRoutes from "./routes/invitationRoutes.js";
import boardRoutes from "./routes/boardRoutes.js";
import { connectDB } from "./config/db.js";
import Board from "./models/Board.js";

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
app.use("/api/invitations", invitationRoutes);
app.use("/api/boards", boardRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
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
  socket.on("joinBoard", ({ boardId, user }) => {
    if (!boardId) return;

    const userId = user?.id || socket.id;
    const name = user?.name || "User";
    const color = pickColor(userId);

    socket.join(boardId);
    socketMeta.set(socket.id, { boardId, userId, name, color });

    // Let others know this cursor exists (optional)
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

server.listen(PORT, () => {
  console.log("Server started on PORT:", PORT);
});
