import { useEffect, useCallback } from "react";

/**
 * Lightweight keyboard wiring for Y.UndoManager-backed history.
 */
export default function useCanvasHistory({
    undoManager,
    isViewerRef,
}) {
    const undo = useCallback(() => {
        if (isViewerRef?.current || !undoManager) return;
        undoManager.undo();
    }, [undoManager, isViewerRef]);

    const redo = useCallback(() => {
        if (isViewerRef?.current || !undoManager) return;
        undoManager.redo();
    }, [undoManager, isViewerRef]);

    useEffect(() => {
        const hkd = (e) => {
            if (isViewerRef?.current) return;
            if (e.ctrlKey || e.metaKey) {
                if (["+", "=", "-", "_", "0"].includes(e.key)) {
                    e.preventDefault();
                    return;
                }
                if (e.key.toLowerCase() === "z") {
                    e.preventDefault();
                    if (e.shiftKey) redo();
                    else undo();
                } else if (e.key.toLowerCase() === "y") {
                    e.preventDefault();
                    redo();
                }
            }
        };

        window.addEventListener("keydown", hkd);
        return () => window.removeEventListener("keydown", hkd);
    }, [undo, redo, isViewerRef]);

    return {
        undo,
        redo,
    };
}
