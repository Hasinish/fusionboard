import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import { Server } from "socket.io";

import { connectDB } from "./startup/db.js";
import { setupMiddleware } from "./startup/middleware.js";
import { registerRoutes } from "./startup/routes.js";
import { setupSocket } from "./startup/socket.js";
import { startYjsServer } from "./startup/yjsServer.js";

const app = express();
const PORT = process.env.PORT || 5001;

// who's allowed to talk to us (cors stuff)
const allowedOrigins = [
  "http://localhost:5173", // Local development
  process.env.FRONTEND_URL, // This will be your Vercel URL
  "https://fusionboard.vercel.app" // Backup fallback
];

// DB Connection
connectDB();

// Middleware Setup
setupMiddleware(app, allowedOrigins);

// Route Registrations
registerRoutes(app);

// Webhook / Web Server setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket Handlers
setupSocket(io);
startYjsServer(server);

server.listen(PORT, () => {
  console.log(`Server started on PORT: ${PORT}`);
});