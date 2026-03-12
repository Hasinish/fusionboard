import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Board from "../models/Board.js";
import Message from "../models/Message.js";
import Workspace from "../models/Workspace.js";
import Notification from "../models/Notification.js";
import Activity from "../models/Activity.js";
import { ensureMember } from "../controllers/chatController.js";

const CURSOR_COLORS = [
    "#dc2626", "#ea580c", "#d97706", "#059669",
    "#0891b2", "#2563eb", "#4f46e5", "#7c3aed",
    "#c026d3", "#db2777", "#4b5563", "#0f172a"
];

function pickColor(key) {
    const s = String(key || Math.random());
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

const socketMeta = new Map();
let ioInstance;

export const emitToUser = (userId, event, data) => {
    if (!ioInstance) return;
    for (const [sid, socket] of ioInstance.sockets.sockets) {
        if (String(socket.userId) === String(userId)) {
            socket.emit(event, data);
        }
    }
};

export const emitToWorkspace = (workspaceId, event, data) => {
    if (!ioInstance) return;
    ioInstance.to(`ws:${workspaceId}`).emit(event, data);
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
            const color = pickColor(socket.id);
            let workspaceId = null;
            let boardTitle = "Unknown Board";
            let existingElements = [];
            let role = "viewer"; // default to most restrictive
            try {
                const board = await Board.findById(boardId).select("workspace title elements");
                if (board) {
                    workspaceId = board.workspace;
                    boardTitle = board.title;
                    existingElements = board.elements || [];
                    // Look up user's role in the workspace
                    if (workspaceId) {
                        const ws = await Workspace.findById(workspaceId).select("members").lean();
                        if (ws && ws.members) {
                            const member = ws.members.find(m => String(m.user) === String(userId));
                            if (member) role = member.role || "viewer";
                        }
                    }
                }
            } catch (e) { /* ignore non-ObjectId boardIds */ }
            // [NEW] If this socket was already in another board, update that board's list first
            const oldMeta = socketMeta.get(socket.id);
            if (oldMeta && oldMeta.boardId && String(oldMeta.boardId) !== String(boardId)) {
                // Remove from old board's room and emit update for old board
                socket.leave(`board:${oldMeta.boardId}`);
                socket.to(`board:${oldMeta.boardId}`).emit("cursorLeave", { userId: oldMeta.userId });
                if (oldMeta.workspaceId) {
                    // Temporarily delete from socketMeta to get accurate count for old board
                    socketMeta.delete(socket.id);
                    const updatedUsersForOldBoard = getActiveBoardUsers(oldMeta.boardId);
                    io.to(`ws:${oldMeta.workspaceId}`).emit("board:users-updated", {
                        boardId: oldMeta.boardId,
                        activeUsers: updatedUsersForOldBoard
                    });
                }
            }

            socket.join(`board:${boardId}`);
            socketMeta.set(socket.id, {
                boardId, userId, name, color,
                workspaceId, boardTitle, hasEdited: false, role,
                avatar: socket.userAvatar
            });

            // Get current participants in this board
            const boardRoom = io.sockets.adapter.rooms.get(`board:${boardId}`);
            const participantIds = boardRoom ? Array.from(boardRoom) : [];
            const participants = participantIds
                .map(sid => {
                    const meta = socketMeta.get(sid);
                    if (!meta) return null;
                    return { userId: meta.userId, name: meta.name, color: meta.color, avatar: meta.avatar };
                })
                .filter(Boolean);

            if (workspaceId) {
                const updatedUsers = getActiveBoardUsers(boardId);
                io.to(`ws:${workspaceId}`).emit("board:users-updated", { boardId, activeUsers: updatedUsers });
            }
            socket.emit("boardParticipants", participants);
            socket.emit("boardElements", existingElements);
            socket.to(`board:${boardId}`).emit("cursorJoin", { userId, name, color, avatar: socket.userAvatar });
        });

        // ─── Live pen stroke preview (vector) ───────────────────────────────────────

        socket.on("draw:stroke-progress", ({ boardId, stroke }) => {
            if (!boardId) return;
            if (isViewerSocket(socket.id)) return;
            const meta = socketMeta.get(socket.id);
            socket.to(`board:${boardId}`).emit("draw:stroke-progress", {
                userId: meta?.userId || socket.userId || socket.id,
                stroke
            });
        });

        socket.on("draw:stroke-end", ({ boardId }) => {
            if (!boardId) return;
            if (isViewerSocket(socket.id)) return;
            const meta = socketMeta.get(socket.id);
            socket.to(`board:${boardId}`).emit("draw:stroke-end", {
                userId: meta?.userId || socket.userId || socket.id
            });
        });

        // ─── Cursors ────────────────────────────────────────────────────────────────

        socket.on("cursorMove", ({ boardId, x, y }) => {
            if (!boardId) return;
            const meta = socketMeta.get(socket.id);
            if (!meta) return;
            if (String(meta.boardId) !== String(boardId)) return;
            socket.to(`board:${boardId}`).emit("cursorMove", {
                userId: meta.userId,
                name: meta.name,
                color: meta.color,
                avatar: meta.avatar,
                x,
                y,
            });
        });

        socket.on("camera:update", ({ boardId, userId, camera }) => {
            if (!boardId) return;
            const meta = socketMeta.get(socket.id);
            if (!meta) return;
            if (String(meta.boardId) !== String(boardId)) return;
            socket.to(`board:${boardId}`).emit("camera:update", {
                userId: userId || socket.userId,
                camera,
            });
        });

        // ─── Elements (sticky notes, shapes, paths, text, code, video) ──────────────

        socket.on("addElement", async ({ boardId, element }) => {
            if (!boardId || !element) return;
            if (isViewerSocket(socket.id)) return;
            socket.to(`board:${boardId}`).emit("elementAdded", element);
            try {
                await Board.findByIdAndUpdate(boardId, { $push: { elements: element } });
            } catch (e) { /* ignore */ }
        });

        socket.on("updateElement", async ({ boardId, element }) => {
            if (!boardId || !element?.id) return;
            if (isViewerSocket(socket.id)) return;
            socket.to(`board:${boardId}`).emit("elementUpdated", element);
            try {
                await Board.findOneAndUpdate(
                    { _id: boardId, "elements.id": element.id },
                    { $set: { "elements.$": element } }
                );
            } catch (e) { /* ignore */ }
        });

        socket.on("updateElements", async ({ boardId, elements }) => {
            if (!boardId || !Array.isArray(elements)) return;
            if (isViewerSocket(socket.id)) return;
            socket.to(`board:${boardId}`).emit("elementsUpdated", elements);
            try {
                const ops = elements.map(el => ({
                    updateOne: {
                        filter: { _id: boardId, "elements.id": el.id },
                        update: { $set: { "elements.$": el } }
                    }
                }));
                await Board.bulkWrite(ops);
            } catch (e) {
                console.error("updateElements error:", e);
            }
        });

        socket.on("deleteElement", async ({ boardId, elementId }) => {
            if (!boardId || !elementId) return;
            if (isViewerSocket(socket.id)) return;
            io.to(`board:${boardId}`).emit("elementDeleted", { elementId });
            try {
                await Board.findByIdAndUpdate(boardId, { $pull: { elements: { id: elementId } } });
            } catch (e) { /* ignore */ }
        });

        socket.on("clearBoard", async ({ boardId }) => {
            if (!boardId) return;
            if (isViewerSocket(socket.id)) return;
            io.to(`board:${boardId}`).emit("cleared");
            try {
                const meta = socketMeta.get(socket.id);
                if (meta) meta.hasEdited = true;
                await Board.findByIdAndUpdate(boardId, { $set: { elements: [] } });
            } catch (e) {
                console.error("clearBoard error:", e);
            }
        });

        socket.on("board:update-title", ({ boardId, title }) => {
            if (!boardId) return;
            if (isViewerSocket(socket.id)) return;
            const meta = socketMeta.get(socket.id);
            if (meta) meta.boardTitle = title;
            socket.to(`board:${boardId}`).emit("board:title-updated", { title });
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

        const leaveCursor = async () => {
            const meta = socketMeta.get(socket.id);
            if (!meta) {
                console.log(`[Socket] No meta found for ${socket.id} on leaveCursor`);
                return;
            }

            console.log(`[Socket] ${socket.id} leaving board ${meta.boardId} (workspace ${meta.workspaceId})`);

            // Notify canvas participants that user left
            if (meta.boardId) {
                socket.to(`board:${meta.boardId}`).emit("cursorLeave", { userId: meta.userId });
            }

            // Log activity if they edited
            if (meta.hasEdited && meta.workspaceId) {
                try {
                    await Activity.create({
                        workspace: meta.workspaceId,
                        user: meta.userId,
                        action: "edited_board",
                        details: meta.boardTitle,
                    });
                } catch (e) { /* ignore */ }
            }

            // [FIX] Store IDs before deleting from the map
            const { workspaceId, boardId } = meta;
            socketMeta.delete(socket.id);

            // Notify dashboard of updated active users
            if (workspaceId && boardId) {
                const updatedUsers = getActiveBoardUsers(boardId);
                console.log(`[Socket] Emitting board:users-updated for board ${boardId} to ws:${workspaceId}`);
                io.to(`ws:${workspaceId}`).emit("board:users-updated", { 
                    boardId: String(boardId), 
                    activeUsers: updatedUsers 
                });
            }
        };

        socket.on("cursorLeave", leaveCursor);
        socket.on("disconnect", leaveCursor);
    });
};

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
