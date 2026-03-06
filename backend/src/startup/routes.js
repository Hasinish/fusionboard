import authRoutes from "../routes/authRoutes.js";
import workspaceRoutes from "../routes/workspaceRoutes.js";
import invitationRoutes from "../routes/invitationRoutes.js";
import boardRoutes from "../routes/boardRoutes.js";
import chatRoutes from "../routes/chatRoutes.js";
import notificationRoutes from "../routes/notificationRoutes.js";
import userRoutes from "../routes/userRoutes.js";
import driveRoutes from "../routes/driveRoutes.js";
import noteRoutes from "../routes/noteRoutes.js";
import activityRoutes from "../routes/activityRoutes.js";

export const registerRoutes = (app) => {
    app.get("/", (req, res) => {
        res.send("Backend is running ✅");
    });

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
};
