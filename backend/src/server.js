import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import invitationRoutes from "./routes/invitationRoutes.js";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";

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
