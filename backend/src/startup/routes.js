import authRoutes from "../routes/authRoutes.js";
import workspaceRoutes from "../routes/workspaceRoutes.js";
import chatRoutes from "../routes/chatRoutes.js";
import invitationRoutes from "../routes/invitationRoutes.js";
import boardRoutes from "../routes/boardRoutes.js";
import noteRoutes from "../routes/noteRoutes.js";
import notificationRoutes from "../routes/notificationRoutes.js";
import userRoutes from "../routes/userRoutes.js";
import driveRoutes from "../routes/driveRoutes.js";
import activityRoutes from "../routes/activityRoutes.js";
import recordingRoutes from "../routes/recordingRoutes.js";
import reminderRoutes from "../routes/reminderRoutes.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

export const registerRoutes = (app) => {
    app.get("/", (req, res) => {
        res.send("Backend is running ✅");
    });

    app.use("/api/auth", authRoutes);
    app.use("/api/workspaces", authMiddleware, workspaceRoutes);
    app.use("/api/workspaces", authMiddleware, chatRoutes);
    app.use("/api/invitations", authMiddleware, invitationRoutes);
    app.use("/api/boards", authMiddleware, boardRoutes);
    app.use("/api/notes", authMiddleware, noteRoutes);
    app.use("/api/notifications", authMiddleware, notificationRoutes);
    app.use("/api/users", authMiddleware, userRoutes);
    app.use("/api/drive", driveRoutes);
    app.use("/api/activities", authMiddleware, activityRoutes);
    app.use("/api/recordings", authMiddleware, recordingRoutes);
    app.use("/api/reminders", authMiddleware, reminderRoutes);
};
