import { useEffect, useRef, useCallback } from "react";

/**
 * useCanvasHistory
 * Manages undo/redo stacks and keyboard shortcuts.
 */
export default function useCanvasHistory({
    socket,
    boardId,
    setElements,
    isViewerRef,
    recordEvent,
    yElements
}) {
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);

    const pushAction = useCallback((action) => {
        undoStackRef.current.push(action);
        redoStackRef.current = [];
    }, []);

    const undo = useCallback(() => {
        const action = undoStackRef.current.pop();
        if (!action) return;

        redoStackRef.current.push(action);

        switch (action.type) {
            case "ADD_ELEMENT":
                setElements(prev => prev.filter(e => e.id !== action.element.id));
                recordEvent("element.deleted", action.element.id, { reason: "undo" });
                if (socket?.connected) socket.emit("deleteElement", { boardId, elementId: action.element.id });
                yElements?.delete(action.element.id);
                break;
            case "UPDATE_ELEMENT":
                setElements(prev => prev.map(e => (e.id === action.id ? action.oldState : e)));
                recordEvent("element.updated", action.id, { element: action.oldState, reason: "undo" });
                if (socket?.connected) socket.emit("updateElement", { boardId, element: action.oldState });
                yElements?.set(action.oldState.id, action.oldState);
                break;
            case "UPDATE_ELEMENTS":
                setElements(prev => {
                    const map = new Map(prev.map(e => [e.id, e]));
                    action.before.forEach(el => map.set(el.id, el));
                    return Array.from(map.values());
                });
                action.before.forEach(el => recordEvent("element.updated", el.id, { element: el, reason: "undo" }));
                if (socket?.connected) socket.emit("updateElements", { boardId, elements: action.before });
                if (yElements) {
                    yElements.doc.transact(() => {
                        action.before.forEach(el => yElements.set(el.id, el));
                    });
                }
                break;
            case "DELETE_ELEMENT":
                setElements(prev => [...prev, action.element]);
                recordEvent("element.created", action.element.id, { element: action.element, reason: "undo" });
                if (socket?.connected) socket.emit("addElement", { boardId, element: action.element });
                yElements?.set(action.element.id, action.element);
                break;
            case "DELETE_ELEMENTS":
            case "ERASE_ELEMENTS":
                // Re-add all erased/deleted elements
                setElements(prev => [...prev, ...action.elements]);
                action.elements.forEach(el => recordEvent("element.created", el.id, { element: el, reason: "undo" }));
                for (const el of action.elements) {
                    if (socket?.connected) socket.emit("addElement", { boardId, element: el });
                    yElements?.set(el.id, el);
                }
                break;
            default:
                break;
        }
    }, [socket, boardId, setElements, recordEvent, yElements]);

    const redo = useCallback(() => {
        const action = redoStackRef.current.pop();
        if (!action) return;

        undoStackRef.current.push(action);

        switch (action.type) {
            case "ADD_ELEMENT":
                setElements(prev => [...prev, action.element]);
                recordEvent("element.created", action.element.id, { element: action.element, reason: "redo" });
                if (socket?.connected) socket.emit("addElement", { boardId, element: action.element });
                yElements?.set(action.element.id, action.element);
                break;
            case "UPDATE_ELEMENT":
                setElements(prev => prev.map(e => (e.id === action.id ? action.newState : e)));
                recordEvent("element.updated", action.id, { element: action.newState, reason: "redo" });
                if (socket?.connected) socket.emit("updateElement", { boardId, element: action.newState });
                yElements?.set(action.newState.id, action.newState);
                break;
            case "UPDATE_ELEMENTS":
                setElements(prev => {
                    const map = new Map(prev.map(e => [e.id, e]));
                    action.after.forEach(el => map.set(el.id, el));
                    return Array.from(map.values());
                });
                action.after.forEach(el => recordEvent("element.updated", el.id, { element: el, reason: "redo" }));
                if (socket?.connected) socket.emit("updateElements", { boardId, elements: action.after });
                if (yElements) {
                    yElements.doc.transact(() => {
                        action.after.forEach(el => yElements.set(el.id, el));
                    });
                }
                break;
            case "DELETE_ELEMENT":
                setElements(prev => prev.filter(e => e.id !== action.element.id));
                recordEvent("element.deleted", action.element.id, { reason: "redo" });
                if (socket?.connected) socket.emit("deleteElement", { boardId, elementId: action.element.id });
                yElements?.delete(action.element.id);
                break;
            case "DELETE_ELEMENTS":
            case "ERASE_ELEMENTS":
                setElements(prev => {
                    const idsToDel = new Set(action.elements.map(e => e.id));
                    return prev.filter(e => !idsToDel.has(e.id));
                });
                action.elements.forEach(el => {
                    recordEvent("element.deleted", el.id, { reason: "redo" });
                    if (socket?.connected) socket.emit("deleteElement", { boardId, elementId: el.id });
                    yElements?.delete(el.id);
                });
                break;
            default:
                break;
        }
    }, [socket, boardId, setElements, recordEvent, yElements]);

    useEffect(() => {
        const hkd = (e) => {
            if (isViewerRef?.current) return;
            if (e.ctrlKey || e.metaKey) {
                if (["+", "=", "-", "_", "0"].includes(e.key)) { e.preventDefault(); return; }
                if (e.key.toLowerCase() === "z") {
                    e.preventDefault();
                    if (e.shiftKey) redo(); else undo();
                } else if (e.key.toLowerCase() === "y") {
                    e.preventDefault(); redo();
                }
            }
        };
        window.addEventListener("keydown", hkd);
        return () => window.removeEventListener("keydown", hkd);
    }, [undo, redo, isViewerRef]);

    return {
        undoStackRef,
        redoStackRef,
        pushAction,
        undo,
        redo
    };
}

// DUAL-WRITE AUDIT — useCanvasHistory
// socket.emit addElement calls: 3
// socket.emit updateElement calls: 2
// socket.emit updateElements calls: 2
// socket.emit deleteElement calls: 3
// yElements writes: 10
// counts match: YES
