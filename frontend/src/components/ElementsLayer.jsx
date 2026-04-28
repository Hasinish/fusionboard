import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { pointHitsElement } from "./canvas/geometryUtils";
import { GhostElement } from "./canvas/GhostElement";
import { SelectionToolbar } from "./canvas/SelectionToolbar";
import { GroupSelectionBox } from "./canvas/GroupSelectionBox";
import { MemoizedBoardElement } from "./canvas/BoardElement";
import { useGroupTransform } from "./canvas/useGroupTransform";
import { useElementKeyboard } from "./canvas/useElementKeyboard";
import {
    useBoardElement,
    useBoardElementsByIds,
    useBoardInteractiveIds,
    useBoardVersion,
} from "../lib/yjsBoard";

const INTERACTIVE_ELEMENT_TYPES = new Set(["text", "code", "video", "graph", "sticky"]);

function OverlayBoardElement({
    id,
    boardStore,
    previewElement,
    camera,
    tool,
    isSelected,
    isMultiSelected,
    onSelect,
    onGroupSelect,
    onChange,
    onDuplicate,
    onDragGuide,
    onStartEdit,
    isEditing,
    onEndEdit,
    isViewer,
    isDarkMode,
    onOpenSidebar,
    sidebarElementId,
    onSidebarElementIdChange,
    isSidebarOpen,
}) {
    const committedElement = useBoardElement(boardStore, id);
    const element = previewElement || committedElement;

    if (!element) return null;
    if (!isSelected && !isEditing && !INTERACTIVE_ELEMENT_TYPES.has(element.type)) {
        return null;
    }

    return (
        <MemoizedBoardElement
            id={id}
            el={element}
            boardStore={boardStore}
            camera={camera}
            tool={tool}
            isSelected={isSelected}
            isMultiSelected={isMultiSelected}
            onSelect={onSelect}
            onGroupSelect={onGroupSelect}
            onChange={onChange}
            onDuplicate={onDuplicate}
            onDragGuide={onDragGuide}
            onStartEdit={onStartEdit}
            isEditing={isEditing}
            onEndEdit={onEndEdit}
            isViewer={isViewer}
            isDarkMode={isDarkMode}
            onOpenSidebar={onOpenSidebar}
            sidebarElementId={sidebarElementId}
            onSidebarElementIdChange={onSidebarElementIdChange}
            isSidebarOpen={isSidebarOpen}
        />
    );
}

export default React.memo(function ElementsLayer({
    tool,
    boardStore,
    boardActions,
    camera,
    isDark,
    selectedIds,
    setSelectedIds,
    ghostElement,
    pendingEditId,
    onPendingEditConsumed,
    isViewer = false,
    onOpenSidebar,
    sidebarElementId,
    onSidebarElementIdChange,
    isSidebarOpen,
    recordEvent,
    rendererRef,
}) {
    const [editingId, setEditingId] = useState(null);
    const [dragGuide, setDragGuide] = useState(null);
    const [previewById, setPreviewById] = useState({});

    const selectedIdsRef = useRef(selectedIds);
    useEffect(() => {
        selectedIdsRef.current = selectedIds;
    }, [selectedIds]);

    const boardVersion = useBoardVersion(boardStore);
    const interactiveIds = useBoardInteractiveIds(boardStore);
    const selectedItems = useBoardElementsByIds(boardStore, selectedIds);
    const orderedIds = useMemo(
        () => {
            if (boardVersion < 0) return [];
            return boardStore?.getOrderedIds?.() || [];
        },
        [boardStore, boardVersion]
    );
    const activeEditingId = pendingEditId || (editingId && boardStore?.hasElement?.(editingId) ? editingId : null);
    const visiblePreviewById = useMemo(() => (
        boardVersion < 0
            ? {}
            : Object.fromEntries(
                Object.entries(previewById).filter(([id]) => boardStore?.hasElement?.(id))
            )
    ), [boardStore, boardVersion, previewById]);

    const selectedItemsWithPreview = useMemo(
        () => selectedItems.map((item) => visiblePreviewById[item.id] || item).filter(Boolean),
        [selectedItems, visiblePreviewById]
    );

    const previewInteractiveIds = useMemo(
        () =>
            Object.values(visiblePreviewById)
                .filter((element) => element?.id && INTERACTIVE_ELEMENT_TYPES.has(element.type))
                .map((element) => element.id),
        [visiblePreviewById]
    );

    const visibleIds = useMemo(() => {
        const visibleSet = new Set([
            ...interactiveIds,
            ...selectedIds,
            ...previewInteractiveIds,
            activeEditingId,
        ].filter(Boolean));
        return orderedIds.filter((id) => visibleSet.has(id));
    }, [activeEditingId, interactiveIds, orderedIds, previewInteractiveIds, selectedIds]);

    useEffect(() => {
        if (pendingEditId) {
            onPendingEditConsumed?.();
        }
    }, [onPendingEditConsumed, pendingEditId]);

    useEffect(() => {
        if (selectedIds.length === 1) {
            const selectedElement = boardStore?.getElement?.(selectedIds[0]);
            if (selectedElement?.type === "graph") {
                onSidebarElementIdChange(selectedElement.id);
            } else if (!isSidebarOpen) {
                onSidebarElementIdChange(null);
            }
        } else if (selectedIds.length === 0 && !isSidebarOpen) {
            onSidebarElementIdChange(null);
        }
    }, [boardStore, boardVersion, isSidebarOpen, onSidebarElementIdChange, selectedIds]);

    const clearPreviewIds = useCallback((ids) => {
        if (!ids?.length) return;
        setPreviewById((prev) => {
            let changed = false;
            const next = { ...prev };
            ids.forEach((id) => {
                if (next[id]) {
                    delete next[id];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, []);

    const setPreviewElements = useCallback((elements) => {
        setPreviewById((prev) => {
            const next = { ...prev };
            const selectedSet = new Set(selectedIdsRef.current);
            let changed = false;

            selectedSet.forEach((id) => {
                if (next[id]) {
                    delete next[id];
                    changed = true;
                }
            });

            (elements || []).forEach((element) => {
                if (!element?.id) return;
                next[element.id] = element;
                changed = true;
            });

            return changed ? next : prev;
        });
    }, []);

    useEffect(() => {
        rendererRef?.current?.setOverlayElementIds(visibleIds);
    }, [rendererRef, visibleIds]);

    useEffect(() => {
        const previewMap = new Map();
        Object.values(visiblePreviewById).forEach((element) => {
            if (!element?.id || INTERACTIVE_ELEMENT_TYPES.has(element.type)) return;
            previewMap.set(element.id, element);
        });
        rendererRef?.current?.setPreviewElements(previewMap);
    }, [rendererRef, visiblePreviewById]);

    const handleChange = useCallback((updated, persist = true, origin = undefined) => {
        if (isViewer || !updated?.id) return;

        if (!persist) {
            setPreviewById((prev) => ({ ...prev, [updated.id]: updated }));
            if (origin !== "DRAG_PREVIEW") {
                recordEvent?.("element.updated", updated.id, { element: updated, persist: false });
            }
            return;
        }

        clearPreviewIds([updated.id]);
        // If an explicit origin is provided (like "DRAG_PREVIEW"), it won't trigger the UndoManager
        boardActions?.updateElement(updated.id, updated, origin ? { origin } : undefined);
        recordEvent?.("element.updated", updated.id, { element: updated, persist: true });
    }, [boardActions, clearPreviewIds, isViewer, recordEvent]);

    const handleDelete = useCallback(() => {
        if (isViewer || selectedIds.length === 0) return;

        const idsToDelete = [...selectedIds];
        boardActions?.deleteElements(idsToDelete);
        idsToDelete.forEach((id) => recordEvent?.("element.deleted", id, {}));
        clearPreviewIds(idsToDelete);
        setSelectedIds([]);
        setEditingId(null);
    }, [boardActions, clearPreviewIds, isViewer, recordEvent, selectedIds, setSelectedIds]);

    const handleDuplicate = useCallback((clone) => {
        if (isViewer || !clone?.id) return;
        boardActions?.createElement(clone);
        setSelectedIds([clone.id]);
        recordEvent?.("element.created", clone.id, { element: clone });
    }, [boardActions, isViewer, recordEvent, setSelectedIds]);

    useElementKeyboard({ selectedIds, editingId: activeEditingId, handleDelete });

    const updateStyle = useCallback((patch, persist = true) => {
        if (isViewer || selectedIds.length === 0) return;

        const updatedElements = selectedIds
            .map((id) => visiblePreviewById[id] || boardStore?.getElement?.(id))
            .filter(Boolean)
            .map((element) => ({ ...element, ...patch }));

        if (!persist) {
            setPreviewElements(updatedElements);
            return;
        }

        clearPreviewIds(selectedIds);
        boardActions?.updateElements(updatedElements);
        updatedElements.forEach((element) => {
            recordEvent?.("element.updated", element.id, { element, persist: true });
        });
    }, [boardActions, boardStore, clearPreviewIds, isViewer, recordEvent, selectedIds, setPreviewElements, visiblePreviewById]);

    const {
        tState,
        selectionBounds,
        selectionRotation,
        onGroupTransformStart,
    } = useGroupTransform({
        camera,
        boardActions,
        selectedIds,
        selectedIdsRef,
        selectedElements: selectedItemsWithPreview,
        onPreviewElementsChange: setPreviewElements,
    });

    const activeGroupBounds = tState?.groupBounds || selectionBounds;
    const isMultiSelect = selectedIds.length > 1;

    const handleSelect = useCallback((id, multi) => {
        if (multi) {
            setSelectedIds((prev) => (
                prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
            ));
        } else {
            setSelectedIds((prev) => (
                prev.length === 1 && prev[0] === id ? prev : [id]
            ));
        }
        setEditingId(null);
    }, [setSelectedIds]);

    const handleStartEdit = useCallback((id) => {
        setSelectedIds([id]);
        setEditingId(id);
    }, [setSelectedIds]);

    const handleEndEdit = useCallback(() => {
        setEditingId(null);
    }, []);

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    return (
        <>
            <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 15, pointerEvents: "none" }}>
                {visibleIds.map((id) => (
                    <OverlayBoardElement
                        key={id}
                        id={id}
                        boardStore={boardStore}
                        previewElement={visiblePreviewById[id]}
                        camera={camera}
                        tool={tool}
                        isSelected={selectedIdSet.has(id)}
                        isMultiSelected={isMultiSelect && selectedIdSet.has(id)}
                        onSelect={handleSelect}
                        onGroupSelect={onGroupTransformStart}
                        onChange={handleChange}
                        onDuplicate={handleDuplicate}
                        onDragGuide={setDragGuide}
                        onStartEdit={handleStartEdit}
                        isEditing={activeEditingId === id}
                        onEndEdit={handleEndEdit}
                        isViewer={isViewer}
                        isDarkMode={isDark}
                        onOpenSidebar={onOpenSidebar}
                        sidebarElementId={sidebarElementId}
                        onSidebarElementIdChange={onSidebarElementIdChange}
                        isSidebarOpen={isSidebarOpen}
                    />
                ))}

                <GhostElement ghost={!isViewer ? ghostElement : null} camera={camera} />

                {dragGuide && (() => {
                    const sx1 = dragGuide.x1 * camera.z + camera.x;
                    const sy1 = dragGuide.y1 * camera.z + camera.y;
                    const sx2 = dragGuide.x2 * camera.z + camera.x;
                    const sy2 = dragGuide.y2 * camera.z + camera.y;
                    const deg = Math.round(dragGuide.angle * 180 / Math.PI);
                    const labelAngle = ((deg % 360) + 360) % 360;
                    const midX = (sx1 + sx2) / 2;
                    const midY = (sy1 + sy2) / 2;
                    return (
                        <svg
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 100, overflow: "visible" }}
                        >
                            <line
                                x1={sx1 - Math.cos(dragGuide.angle) * 2000}
                                y1={sy1 - Math.sin(dragGuide.angle) * 2000}
                                x2={sx1 + Math.cos(dragGuide.angle) * 2000}
                                y2={sy1 + Math.sin(dragGuide.angle) * 2000}
                                stroke="#2563eb"
                                strokeWidth="1"
                                strokeDasharray="6 4"
                                opacity="0.4"
                            />
                            <line
                                x1={sx1}
                                y1={sy1}
                                x2={sx2}
                                y2={sy2}
                                stroke="#2563eb"
                                strokeWidth="1.5"
                                strokeDasharray="6 4"
                            />
                            <circle cx={sx1} cy={sy1} r="4" fill="#2563eb" opacity="0.7" />
                            <rect x={midX - 20} y={midY - 11} width="40" height="18" rx="5" fill="#1e40af" opacity="0.85" />
                            <text x={midX} y={midY + 4} textAnchor="middle" fill="white" fontSize="11" fontFamily="monospace" fontWeight="bold">{labelAngle}°</text>
                        </svg>
                    );
                })()}

                <GroupSelectionBox
                    selectedIds={selectedIds}
                    groupBounds={selectionBounds}
                    selectionRotation={selectionRotation}
                    tState={tState}
                    camera={camera}
                    editingId={activeEditingId}
                    onGroupTransformStart={onGroupTransformStart}
                    handleSelect={handleSelect}
                    setSelectedIds={setSelectedIds}
                    boardStore={boardStore}
                    pointHitsElement={pointHitsElement}
                />
            </div>

            {!isViewer && selectedItemsWithPreview.length > 0 && !activeEditingId && activeGroupBounds && (
                <SelectionToolbar
                    selectedItems={selectedItemsWithPreview}
                    updateStyle={updateStyle}
                    handleDelete={handleDelete}
                    activeBounds={activeGroupBounds}
                    camera={camera}
                    isDark={isDark}
                    onSettingsClick={() => {
                        if (selectedItemsWithPreview.length === 1) {
                            onSidebarElementIdChange(selectedItemsWithPreview[0].id);
                            onOpenSidebar(true);
                        }
                    }}
                />
            )}
        </>
    );
});
