import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useCanvasRealtime
 * Manages socket subscriptions, participants, cursors, and remote strokes.
 * Also handles throttled emission of transient data like cursor position and camera.
 */
export default function useCanvasRealtime({
    boardId,
    socket,
    me,
    // Dependency setters from other domains
    setElements,
    setCamera,
    followedUserIdRef,
    remoteCamerasRef,
    // UI feedback
    setStatusMsg,
    // Undo/Redo reset
    undoStackRef,
    redoStackRef,
    recordEvent,
    // Canvas renderer
    rendererRef,
    // Yjs
    yElements
}) {
    const [participants, setParticipants] = useState([]);
    const [cursors, setCursors] = useState({});
    const [remoteLiveStrokes, setRemoteLiveStrokes] = useState({}); // userId -> stroke object

    const lastCameraEmitRef = useRef(0);
    const lastCursorEmitRef = useRef(0);

    // ─── Socket Subscriptions ────────────────────────────────────────────────

    useEffect(() => {
        if (!socket) return;

        // --- Elements ---
        socket.on("boardElements", (els) => {
            setElements(els || []);
            rendererRef?.current?.setElements(els || []);
            // Populate Yjs on initial board load (safety net — Part 1 sends [])
            if (yElements && Array.isArray(els) && els.length > 0) {
                yElements.doc.transact(() => {
                    yElements.clear();
                    els.forEach(el => {
                        if (el?.id) yElements.set(el.id, el);
                    });
                }, "server-init");
            }
        });
        socket.on("elementAdded", (el) => {
            setElements(prev => [...prev, el]);
            rendererRef?.current?.updateElement(el);
            recordEvent("element.created", el.id, { element: el });
        });
        socket.on("elementUpdated", (el) => {
            setElements(prev => prev.map(e => e.id === el.id ? el : e));
            rendererRef?.current?.updateElement(el);
            recordEvent("element.updated", el.id, { element: el });
        });
        socket.on("elementsUpdated", (newElements) => {
            if (!Array.isArray(newElements)) return;
            setElements(prev => {
                const map = new Map(prev.map(e => [e.id, e]));
                newElements.forEach(el => {
                    if (el && el.id) {
                        map.set(el.id, el);
                        rendererRef?.current?.updateElement(el);
                    }
                });
                return Array.from(map.values());
            });
        });
        socket.on("elementDeleted", ({ elementId }) => {
            setElements(prev => prev.filter(e => e.id !== elementId));
            rendererRef?.current?.deleteElement(elementId);
            recordEvent("element.deleted", elementId, {});
        });

        socket.on("cleared", () => {
            if (undoStackRef) undoStackRef.current = [];
            if (redoStackRef) redoStackRef.current = [];
            setElements([]);
            rendererRef?.current?.setElements([]);
            setStatusMsg?.("Cleared ✅");
            recordEvent("board.cleared", null, {});
            setTimeout(() => setStatusMsg?.(""), 1500);
        });

        socket.on("saved", () => {
            setStatusMsg?.("Saved ✅");
            setTimeout(() => setStatusMsg?.(""), 1500);
        });

        // --- Participants / Presence ---
        socket.on("boardParticipants", (p) => {
            const standardized = (p || []).map(entry => ({
                ...entry,
                userId: entry.userId ? String(entry.userId) : entry.userId
            }));
            setParticipants(standardized);
        });

        socket.on("cursorJoin", ({ userId, name, color, avatar }) => {
            const uid = String(userId);
            setCursors(prev => ({ ...prev, [uid]: { name, color, avatar, x: 0, y: 0, ts: Date.now() } }));
            setParticipants(prev => {
                if (prev.find(p => String(p.userId) === uid)) {
                    return prev.map(p => String(p.userId) === uid ? { ...p, name, color, avatar } : p);
                }
                return [...prev, { userId: uid, name, color, avatar }];
            });
        });

        socket.on("cursorMove", ({ userId, name, color, avatar, x, y }) => {
            const uid = String(userId);
            setCursors(prev => ({ ...prev, [uid]: { name, color, avatar, x, y, ts: Date.now() } }));
            recordEvent("cursor.moved", uid, { x, y, name, color, avatar });
            setParticipants(prev => {
                if (prev.find(p => String(p.userId) === uid)) {
                    return prev.map(p => String(p.userId) === uid ? { ...p, name, color, avatar } : p);
                }
                return [...prev, { userId: uid, name, color, avatar }];
            });
        });

        socket.on("cursorLeave", ({ userId }) => {
            const uid = String(userId);
            setParticipants(prev => prev.filter(p => String(p.userId) !== uid));
            setCursors(prev => {
                const next = { ...prev };
                delete next[uid];
                return next;
            });
            setRemoteLiveStrokes(prev => {
                const next = { ...prev };
                delete next[uid];
                return next;
            });
        });

        // --- Live Drawing ---
        socket.on("draw:stroke-progress", ({ userId, stroke }) => {
            setRemoteLiveStrokes(prev => {
                const isNew = !prev[userId];
                // Record for replay
                if (isNew) {
                    recordEvent("path.started", stroke.id, { 
                        points: stroke.points, 
                        color: stroke.color, 
                        width: stroke.width, 
                        opacity: stroke.opacity 
                    });
                } else {
                    const lastPoint = stroke.points[stroke.points.length - 1];
                    recordEvent("path.appended", stroke.id, { newPoint: lastPoint });
                }

                return {
                    ...prev,
                    [userId]: stroke
                };
            });
        });

        socket.on("draw:stroke-end", ({ userId }) => {
            setRemoteLiveStrokes(prev => {
                const stroke = prev[userId];
                if (stroke) {
                    recordEvent("path.finished", stroke.id, {});
                }
                const next = { ...prev };
                delete next[userId];
                return next;
            });
        });

        // --- Camera / Follow Sync ---
        socket.on("camera:update", ({ userId, camera: remoteCamera }) => {
            const uid = String(userId);
            if (remoteCamerasRef) remoteCamerasRef.current[uid] = remoteCamera;
            
            // If we are following this user, update our camera
            if (followedUserIdRef?.current && String(followedUserIdRef.current) === uid) {
                setCamera(remoteCamera);
            }
        });

        return () => {
            // Explicitly notify the backend that this user is leaving the board interaction
            socket.emit("cursorLeave");

            socket.off("boardElements");
            socket.off("elementAdded");
            socket.off("elementUpdated");
            socket.off("elementsUpdated");
            socket.off("elementDeleted");
            socket.off("cleared");
            socket.off("saved");
            socket.off("boardParticipants");
            socket.off("cursorJoin");
            socket.off("cursorMove");
            socket.off("cursorLeave");
            socket.off("draw:stroke-progress");
            socket.off("draw:stroke-end");
            socket.off("camera:update");
        };
    }, [socket, boardId, setElements, setCamera, followedUserIdRef, remoteCamerasRef, setStatusMsg, undoStackRef, redoStackRef, yElements]);

    // ─── Yjs Observer ─────────────────────────────────────────────────────────

    useEffect(() => {
        if (!yElements) return;

        const observer = (event, transaction) => {
            if (transaction.local) return;

            event.changes.keys.forEach((change, id) => {
                if (change.action === "add" || change.action === "update") {
                    const el = yElements.get(id);
                    if (!el) return;
                    setElements(prev => {
                        const exists = prev.find(e => e.id === id);
                        if (exists) return prev.map(e => e.id === id ? el : e);
                        return [...prev, el];
                    });
                    rendererRef?.current?.updateElement(el);
                } else if (change.action === "delete") {
                    setElements(prev => prev.filter(e => e.id !== id));
                    rendererRef?.current?.deleteElement(id);
                }
            });
        };

        yElements.observe(observer);
        return () => yElements.unobserve(observer);
    }, [yElements, setElements, rendererRef]);

    // ─── Automatic Cleanups ──────────────────────────────────────────────────

    useEffect(() => {
        const t = setInterval(() => {
            const now = Date.now();
            setCursors(prev => {
                const copy = { ...prev };
                let changed = false;
                for (const [uid, c] of Object.entries(copy)) {
                    if (now - c.ts > 8000) {
                        delete copy[uid];
                        changed = true;
                    }
                }
                return changed ? copy : prev;
            });
        }, 2000);
        return () => clearInterval(t);
    }, []);

    // ─── Emitters ────────────────────────────────────────────────────────────

    const emitCursorMove = useCallback((x, y) => {
        if (!socket?.connected) return;
        const now = Date.now();
        if (now - lastCursorEmitRef.current > 40) {
            socket.emit("cursorMove", { boardId, x, y });
            lastCursorEmitRef.current = now;
        }
    }, [socket, boardId]);

    const emitCameraUpdate = useCallback((camera) => {
        if (!socket?.connected) return;
        // Don't broadcast our camera when we're just following someone else
        if (followedUserIdRef?.current) return;

        const now = Date.now();
        if (now - lastCameraEmitRef.current > 50) {
            socket.emit("camera:update", { boardId, userId: me?.userId || me?.id, camera });
            lastCameraEmitRef.current = now;
        }
    }, [socket, boardId, me, followedUserIdRef]);

    const emitClearBoard = useCallback(() => {
        if (!socket?.connected) return;
        socket.emit("clearBoard", { boardId });
    }, [socket, boardId]);

    return {
        participants,
        setParticipants,
        cursors,
        setCursors,
        remoteLiveStrokes,
        setRemoteLiveStrokes,
        emitCursorMove,
        emitCameraUpdate,
        emitClearBoard
    };
}
