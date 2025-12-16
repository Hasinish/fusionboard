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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
connectDB();

// middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

// routes
app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/invitations", invitationRoutes);

// --- HTTP + Socket.IO setup ---
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket auth middleware (JWT)
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

// --- Voice room signaling (WebRTC) ---
io.on("connection", (socket) => {
  // Join voice room
  socket.on("voice:join", ({ roomId }) => {
    if (!roomId) return;

    socket.join(roomId);

    // Get existing sockets in the room (excluding this socket)
    const room = io.sockets.adapter.rooms.get(roomId);
    const peers = room ? Array.from(room).filter((id) => id !== socket.id) : [];

    // Send the new user the list of existing peers
    socket.emit("voice:peers", { peers });

    // Tell existing peers that someone joined
    socket.to(roomId).emit("voice:peer-joined", {
      peerId: socket.id,
    });
  });

  // Relay signaling messages: offer/answer/ice
  socket.on("voice:signal", ({ to, data }) => {
    if (!to) return;
    io.to(to).emit("voice:signal", {
      from: socket.id,
      data,
    });
  });

  // Leave explicitly (optional)
  socket.on("voice:leave", ({ roomId }) => {
    if (!roomId) return;
    socket.leave(roomId);
    socket.to(roomId).emit("voice:peer-left", { peerId: socket.id });
  });

  // On disconnect, notify all rooms the socket was in
  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      // socket.rooms includes socket.id itself; ignore that
      if (roomId === socket.id) continue;
      socket.to(roomId).emit("voice:peer-left", { peerId: socket.id });
    }
  });
});

// start server
server.listen(PORT, () => {
  console.log("Server started on PORT:", PORT);
});
