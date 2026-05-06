import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Board from "../models/Board.js";
import Message from "../models/Message.js";
import Workspace from "../models/Workspace.js";
import Notification from "../models/Notification.js";
import Activity from "../models/Activity.js";
import { ensureMember } from "../controllers/chatController.js";
import { handleTerminalConnection } from "../services/terminalService.js";

const socketMeta = new Map();
let ioInstance;

export const emitToUser = (userId, event, data) => {
    if (!ioInstance) return;
    ioInstance.to(String(userId)).emit(event, data);
};

export const emitToWorkspace = (workspaceId, event, data) => {
    if (!ioInstance) return;
    ioInstance.to(`ws:${String(workspaceId)}`).emit(event, data);
};

export const setupSocket = (io) => {
    ioInstance = io;
    function broadcastParticipants(roomId) {
        const room = io.sockets.adapter.rooms.get(roomId);
        const socketIds = room ? Array.from(room) : [];
        const participants = socketIds
            .map((sid) => {
                const s = io.sockets.sockets.get(sid);
                if (!s) return null;
                const meta = socketMeta.get(sid);

                let role = meta?.role;
                if (!role) {
                    // Voice socket — look up role by userId from board socketMeta
                    for (const [, m] of socketMeta) {
                        if (String(m.userId) === String(s.userId)) {
                            role = m.role;
                            break;
                        }
                    }
                }
                role = role || "viewer";

                return {
                    peerId: sid,
                    userId: s.userId,
                    name: s.userName || "Unknown",
                    isMuted: !!s.isMuted,
                    role: role
                };
            })
            .filter(Boolean);
        io.to(roomId).emit("voice:participants:update", { participants });
    }

    // Helper: check if a socket belongs to a viewer
    function isViewerSocket(socketId) {
        const meta = socketMeta.get(socketId);
        if (meta) return meta.role === "viewer";
        // Voice sockets have no socketMeta — look up by userId across all board sockets
        const s = io.sockets.sockets.get(socketId);
        if (!s?.userId) return true;
        for (const [, m] of socketMeta) {
            if (String(m.userId) === String(s.userId)) return m.role === "viewer";
        }
        return true;
    }

    // make sure socket users actually have a valid token
    io.use(async (socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace("Bearer ", "");

            if (!token) return next(new Error("No token"));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = String(decoded.id);

            const user = await User.findById(userId).select("name email avatar").lean();
            if (!user) return next(new Error("User not found"));

            socket.userId = userId;
            socket.userName = user.name || "Unknown";
            socket.userAvatar = user.avatar;

            return next();
        } catch {
            return next(new Error("Invalid token"));
        }
    });

    function getActiveBoardUsers(boardId) {
        const seen = new Set();
        const users = [];
        for (const [sid, meta] of socketMeta) {
            // Prune stale sockets that didn't fire disconnect/leave events
            const s = io.sockets.sockets.get(sid);
            if (!s || !s.connected) {
                socketMeta.delete(sid);
                continue;
            }

            if (String(meta.boardId) === String(boardId) && !seen.has(String(meta.userId))) {
                seen.add(String(meta.userId));
                users.push({ userId: meta.userId, name: meta.name, avatar: meta.avatar });
            }
        }
        return users;
    }

    io.on("connection", (socket) => {
        // Automatically join a room for this specific user to receive direct events (like notifications)
        if (socket.userId) {
            socket.join(String(socket.userId));
        }

        handleTerminalConnection(socket);
        // handling voice chat stuff
        socket.on("voice:join", ({ roomId }) => {
            if (!roomId) return;
            socket.join(roomId);
            socket.isMuted = true;
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
                            userId: s.userId,
                            name: s.userName || "Unknown",
                            isMuted: !!s.isMuted
                        };
                    })
                    .filter(Boolean);
                io.to(roomId).emit("voice:participants:update", { participants });
            }
        });

        // handling text chat in workspaces
        socket.on("workspace:join", async ({ workspaceId }, ack) => {
            try {
                const check = await ensureMember(workspaceId, socket.userId);
                if (!check.ok) {
                    if (ack) ack({ ok: false, message: check.message });
                    return;
                }
                socket.join(`ws:${workspaceId}`);
                if (ack) ack({ ok: true });

                // Immediately push current active-user snapshot to this socket
                // so the dashboard shows live presence without waiting for a join/leave event
                try {
                    const boards = await Board.find({ workspace: workspaceId }).select("_id").lean();
                    const boardIds = boards.map(b => b._id);
                    const usersMap = getActiveUsersMap(boardIds);
                    boardIds.forEach(boardId => {
                        socket.emit("board:users-updated", {
                            boardId: String(boardId),
                            activeUsers: usersMap[boardId] || [],
                        });
                    });
                } catch (snapErr) {
                    console.error("[Socket] Failed to push presence snapshot:", snapErr);
                }
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
                    .populate("sender", "name email avatar")
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
                        recipients.forEach((recipientId) => {
                            emitToUser(recipientId, "notification:refresh", {});
                        });
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

        // ─── Whiteboard ─────────────────────────────────────────────────────────────

        socket.on("joinBoard", async ({ boardId, user }) => {
            if (!boardId) return;
            const name = user?.name ? String(user.name) : socket.userName || "User";
            const userId = socket.userId;
            let workspaceId = null;
            let role = "viewer";

            try {
                const board = await Board.findById(boardId).select("workspace").lean();
                if (board?.workspace) {
                    workspaceId = board.workspace;
                    const ws = await Workspace.findById(workspaceId).select("members").lean();
                    if (ws?.members) {
                        const member = ws.members.find((entry) => String(entry.user) === String(userId));
                        if (member) role = member.role || "viewer";
                    }
                }
            } catch {
                // Non-persistent test rooms are allowed.
            }

            const oldMeta = socketMeta.get(socket.id);
            if (oldMeta?.boardId && String(oldMeta.boardId) !== String(boardId)) {
                socket.leave(`board:${oldMeta.boardId}`);
                if (oldMeta.workspaceId) {
                    socketMeta.delete(socket.id);
                    const updatedUsersForOldBoard = getActiveBoardUsers(oldMeta.boardId);
                    io.to(`ws:${String(oldMeta.workspaceId)}`).emit("board:users-updated", {
                        boardId: oldMeta.boardId,
                        activeUsers: updatedUsersForOldBoard
                    });
                }
            }

            socket.join(`board:${boardId}`);
            socketMeta.set(socket.id, {
                boardId,
                userId,
                name,
                workspaceId,
                role,
                avatar: socket.userAvatar
            });

            if (workspaceId) {
                const updatedUsers = getActiveBoardUsers(boardId);
                io.to(`ws:${String(workspaceId)}`).emit("board:users-updated", {
                    boardId,
                    activeUsers: updatedUsers
                });
            }
        });


        // ─── Voice: grant unmute to a viewer ─────────────────────────────────────
        socket.on("voice:grant-unmute", ({ targetUserId }) => {
            if (!targetUserId) return;
            if (isViewerSocket(socket.id)) return;
            for (const [sid, s] of io.sockets.sockets) {
                if (String(s.userId) === String(targetUserId)) {
                    io.to(sid).emit("voice:grant-unmute", { userId: targetUserId });
                }
            }
        });

        socket.on("voice:revoke-unmute", ({ targetUserId }) => {
            if (!targetUserId) return;
            if (isViewerSocket(socket.id)) return;
            for (const [sid, s] of io.sockets.sockets) {
                if (String(s.userId) === String(targetUserId)) {
                    io.to(sid).emit("voice:revoke-unmute", { userId: targetUserId });
                }
            }
        });

        const leaveBoard = async () => {
            const meta = socketMeta.get(socket.id);
            if (!meta) return;

            console.log(`[Socket] ${socket.id} leaving board ${meta.boardId} (workspace ${meta.workspaceId})`);
            const { workspaceId, boardId } = meta;
            if (boardId) {
                socket.leave(`board:${boardId}`);
            }
            socketMeta.delete(socket.id);

            if (workspaceId && boardId) {
                const updatedUsers = getActiveBoardUsers(boardId);
                console.log(`[Socket] Emitting board:users-updated for board ${boardId} to ws:${workspaceId}`);
                io.to(`ws:${String(workspaceId)}`).emit("board:users-updated", { 
                    boardId: String(boardId), 
                    activeUsers: updatedUsers 
                });
            }
        };

        socket.on("leaveBoard", leaveBoard);
        socket.on("disconnect", leaveBoard);
    });
};

export function getActiveBoardUsers(boardId) {
    const unique = [];
    const seen = new Set();
    for (const [sid, meta] of socketMeta) {
        if (ioInstance) {
            const s = ioInstance.sockets.sockets.get(sid);
            if (!s || !s.connected) {
                socketMeta.delete(sid);
                continue;
            }
        }
        if (String(meta.boardId) === String(boardId)) {
            if (!seen.has(String(meta.userId))) {
                seen.add(String(meta.userId));
                unique.push({
                    userId: meta.userId,
                    name: meta.name,
                    avatar: meta.avatar
                });
            }
        }
    }
    return unique;
}

export function getActiveUsersMap(boardIds) {
    const res = {};
    for (const boardId of boardIds) {
        const unique = [];
        const seen = new Set();

        // Iterate over all active sockets in socketMeta
        for (const [sid, meta] of socketMeta) {
            // Prune stale sockets
            if (ioInstance) {
                const s = ioInstance.sockets.sockets.get(sid);
                if (!s || !s.connected) {
                    socketMeta.delete(sid);
                    continue;
                }
            }

            if (String(meta.boardId) === String(boardId)) {
                if (!seen.has(String(meta.userId))) {
                    seen.add(String(meta.userId));
                    unique.push({
                        userId: meta.userId,
                        name: meta.name,
                        avatar: meta.avatar
                    });
                }
            }
        }
        res[boardId] = unique;
    }
    return res;
}
