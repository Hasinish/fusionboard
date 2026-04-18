import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Hook to manage local canvas UI state.
 */
export function useCanvasElementsState(tool) {
    // selected ids
    const [selectedIds, setSelectedIds] = useState([]);

    // Clear selection if tool is not 'select'
    useEffect(() => {
        if (tool !== "select") {
            queueMicrotask(() => setSelectedIds([]));
        }
    }, [tool, setSelectedIds]);

    // selection box (marquee)
    const [selectionBox, setSelectionBoxState] = useState(null);
    const selectionBoxRef = useRef(null);
    const setSelectionBox = useCallback((box) => {
        setSelectionBoxState(box);
        selectionBoxRef.current = box;
    }, []);

    // ghost element (preview for new shapes)
    const [ghostElement, setGhostElement] = useState(null);

    // text editing
    const [pendingEditId, setPendingEditId] = useState(null);
    const clearPendingEditId = useCallback(() => setPendingEditId(null), []);

    return {
        selectedIds, setSelectedIds,
        selectionBox, setSelectionBox, selectionBoxRef,
        ghostElement, setGhostElement,
        pendingEditId, setPendingEditId, clearPendingEditId
    };
}

export default useCanvasElementsState;
