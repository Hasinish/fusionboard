import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Hook to manage elements, selection, and document state.
 */
export function useCanvasElementsState(tool) {
    // elements
    const [elements, setElementsState] = useState([]);
    const elementsRef = useRef(elements);
    
    const setElements = useCallback((updater) => {
        setElementsState(current => {
            const next = typeof updater === "function" ? updater(current) : updater;
            elementsRef.current = next;
            return next;
        });
    }, []);

    // selected ids
    const [selectedIds, setSelectedIdsState] = useState([]);
    const selectedIdsRef = useRef(selectedIds);
    
    const setSelectedIds = useCallback((updater) => {
        setSelectedIdsState(current => {
            const next = typeof updater === "function" ? updater(current) : updater;
            selectedIdsRef.current = next;
            return next;
        });
    }, []);

    // Clear selection if tool is not 'select'
    useEffect(() => {
        if (tool !== "select") setSelectedIds([]);
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
        elements, setElements, elementsRef,
        selectedIds, setSelectedIds, selectedIdsRef,
        selectionBox, setSelectionBox, selectionBoxRef,
        ghostElement, setGhostElement,
        pendingEditId, setPendingEditId, clearPendingEditId
    };
}

export default useCanvasElementsState;
