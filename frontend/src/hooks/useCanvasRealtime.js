import { useState, useEffect, useRef, useCallback } from "react";

const CURSOR_COLORS = [
    "#dc2626", "#ea580c", "#d97706", "#059669",
    "#0891b2", "#2563eb", "#4f46e5", "#7c3aed",
    "#c026d3", "#db2777", "#4b5563", "#0f172a"
];

function pickColor(key) {
    const source = String(key || Math.random());
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
        hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
    }
    return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

function shallowParticipantsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        const left = a[i];
        const right = b[i];
        if (
            left.userId !== right.userId ||
            left.name !== right.name ||
            left.color !== right.color ||
            left.avatar !== right.avatar
        ) {
            return false;
        }
    }
    return true;
}

export default function useCanvasRealtime({
    awareness,
    me,
    setCamera,
    followedUserIdRef,
    remoteCamerasRef,
    rendererRef,
    recordEvent,
}) {
    const [participants, setParticipants] = useState([]);

    const lastCameraEmitRef = useRef(0);
    const lastCursorEmitRef = useRef(0);
    const lastStrokeEmitRef = useRef(0);
    const participantsRef = useRef([]);

    const userId = String(me?.userId || me?.id || "");
    const userColor = pickColor(userId || me?.name || "fusionboard-user");

    const updateLocalPresence = useCallback((patch) => {
        if (!awareness) return;
        const current = awareness.getLocalState() || {};
        awareness.setLocalState({
            ...current,
            userId,
            name: me?.name || "You",
            avatar: me?.avatar || null,
            color: current.color || userColor,
            ...patch,
        });
    }, [awareness, me?.avatar, me?.name, userColor, userId]);

    useEffect(() => {
        if (!awareness || !userId) return;

        updateLocalPresence({
            cursor: null,
            camera: null,
            liveStroke: null,
        });

        return () => {
            const state = awareness.getLocalState();
            if (!state) return;
            awareness.setLocalState(null);
        };
    }, [awareness, updateLocalPresence, userId]);

    useEffect(() => {
        if (!awareness) return;

        const refreshPresence = () => {
            const nextParticipantsMap = new Map();
            const nextCursors = {};
            const nextLiveStrokes = {};
            const nextRemoteCameras = {};

            awareness.getStates().forEach((state, clientId) => {
                if (!state?.userId) return;
                const uid = String(state.userId);

                // For the avatar list, only add if not already present
                if (!nextParticipantsMap.has(uid)) {
                    nextParticipantsMap.set(uid, {
                        userId: uid,
                        name: state.name || "Unknown",
                        color: state.color || pickColor(uid),
                        avatar: state.avatar || null,
                    });
                }

                if (state.cursor) {
                    nextCursors[uid] = {
                        ...state.cursor,
                        name: state.name || "Unknown",
                        color: state.color || pickColor(uid),
                        avatar: state.avatar || null,
                    };
                }

                if (state.liveStroke) {
                    nextLiveStrokes[uid] = state.liveStroke;
                }

                if (state.camera) {
                    nextRemoteCameras[uid] = state.camera;
                }
            });

            const nextParticipants = Array.from(nextParticipantsMap.values());
            nextParticipants.sort((a, b) => a.name.localeCompare(b.name));

            if (!shallowParticipantsEqual(participantsRef.current, nextParticipants)) {
                participantsRef.current = nextParticipants;
                setParticipants(nextParticipants);
            }

            if (remoteCamerasRef) {
                remoteCamerasRef.current = nextRemoteCameras;
            }

            if (followedUserIdRef?.current) {
                const followedCamera = nextRemoteCameras[String(followedUserIdRef.current)];
                if (followedCamera) {
                    setCamera(followedCamera);
                }
            }

            rendererRef?.current?.syncOverlays({
                cursors: nextCursors,
                remoteLiveStrokes: nextLiveStrokes,
            });
        };

        refreshPresence();
        awareness.on("change", refreshPresence);

        return () => {
            awareness.off("change", refreshPresence);
        };
    }, [awareness, followedUserIdRef, remoteCamerasRef, rendererRef, setCamera]);

    const emitCursorMove = useCallback((x, y) => {
        if (!awareness || !userId) return;

        const now = Date.now();
        if (now - lastCursorEmitRef.current < 40) return;

        updateLocalPresence({
            cursor: { x, y, ts: now },
        });
        lastCursorEmitRef.current = now;
        recordEvent?.("cursor.moved", userId, {
            x,
            y,
            name: me?.name || "You",
            color: userColor,
            avatar: me?.avatar || null,
        });
    }, [awareness, me?.avatar, me?.name, recordEvent, updateLocalPresence, userColor, userId]);

    const emitCameraUpdate = useCallback((camera) => {
        if (!awareness || !userId) return;
        if (followedUserIdRef?.current) return;

        const now = Date.now();
        if (now - lastCameraEmitRef.current < 50) return;

        updateLocalPresence({ camera });
        lastCameraEmitRef.current = now;
    }, [awareness, followedUserIdRef, updateLocalPresence, userId]);

    const emitStrokeProgress = useCallback((stroke) => {
        if (!awareness || !userId) return;

        const now = Date.now();
        if (now - lastStrokeEmitRef.current < 40) return;

        updateLocalPresence({ liveStroke: stroke });
        lastStrokeEmitRef.current = now;
    }, [awareness, updateLocalPresence, userId]);

    const emitStrokeEnd = useCallback(() => {
        if (!awareness || !userId) return;
        updateLocalPresence({ liveStroke: null });
    }, [awareness, updateLocalPresence, userId]);

    return {
        participants,
        emitCursorMove,
        emitCameraUpdate,
        emitStrokeProgress,
        emitStrokeEnd,
    };
}
