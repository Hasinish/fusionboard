import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Trash2, Bold, Italic, AlignLeft, AlignCenter, AlignRight, RotateCcw, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Play, Loader2, RefreshCw, Youtube } from "lucide-react";
import { FONTS, COLORS, DEFAULT_ELEMENT_STYLES } from "./canvas/constants";
import { getSvgPathFromStroke, getPathBounds, getElementBounds, getDistToSegment, pointInTriangle, pointHitsElement } from "./canvas/geometryUtils";
import { MemoizedColorMenu } from "./canvas/ColorMenu";
import { ShapeSVG, PathSVG } from "./canvas/ShapeRenderers";
import { GhostElement } from "./canvas/GhostElement";


import { SelectionToolbar } from "./canvas/SelectionToolbar";
import { GroupSelectionBox } from "./canvas/GroupSelectionBox";
import BoardElement, { MemoizedBoardElement } from "./canvas/BoardElement";
import { useGroupTransform } from "./canvas/useGroupTransform";
import { useElementKeyboard } from "./canvas/useElementKeyboard";


export default React.memo(function ElementsLayer({
    tool, elements, camera, boardId, socket, isDark,
    onElementsChange, selectedIds, setSelectedIds, ghostElement, pushAction,
    pendingEditId, onPendingEditConsumed
}) {
    const [editingId, setEditingId] = useState(null);
    const [dragGuide, setDragGuide] = useState(null); // { x1, y1, x2, y2, angle } in world coords
    const updateTimer = useRef({});
    const socketRef = useRef(socket);
    const propertyEditStateRef = useRef(null); // Tracks the "true" before-state for undo

    const elementsRef = useRef(elements);
    elementsRef.current = elements;
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;

    useEffect(() => { socketRef.current = socket; }, [socket]);

    // When parent requests editing a newly created element (e.g. text tool click)
    useEffect(() => {
        if (pendingEditId) {
            setSelectedIds([pendingEditId]);
            setEditingId(pendingEditId);
            onPendingEditConsumed?.();
        }
    }, [pendingEditId, setSelectedIds, onPendingEditConsumed]);

    const selectedItems = useMemo(() => elements.filter(e => selectedIds.includes(e.id)), [elements, selectedIds]);
    const isMultiSelect = selectedIds.length > 1;

    const lastEmitRef = useRef({});

    const handleChange = useCallback((updated, persist = false, beforeState = null) => {
        onElementsChange(prev => prev.map(e => (e.id === updated.id ? updated : e)));

        const now = Date.now();
        const lastEmit = lastEmitRef.current[updated.id] || 0;

        if (persist) {
            if (beforeState) {
                pushAction({ type: "UPDATE_ELEMENT", id: updated.id, oldState: beforeState, newState: updated });
            }
            if (socketRef.current?.connected) {
                socketRef.current.emit("updateElement", { boardId, element: updated });
                lastEmitRef.current[updated.id] = now;
            }
        } else if (now - lastEmit > 50) {
            if (socketRef.current?.connected) {
                socketRef.current.emit("updateElement", { boardId, element: updated });
                lastEmitRef.current[updated.id] = now;
            }
        }
    }, [boardId, onElementsChange, pushAction]);

    const handleDelete = useCallback(() => {
        if (selectedIds.length === 0) return;
        const deletedItems = elements.filter(el => selectedIds.includes(el.id));
        onElementsChange(prev => prev.filter(e => !selectedIds.includes(e.id)));
        setSelectedIds([]);
        setEditingId(null);
        pushAction({ type: "DELETE_ELEMENTS", elements: deletedItems });
        deletedItems.forEach(el => {
            if (socketRef.current?.connected) {
                socketRef.current.emit("deleteElement", { boardId, elementId: el.id });
            }
        });
    }, [selectedIds, elements, onElementsChange, pushAction, socketRef, boardId, setSelectedIds]);

    const handleDuplicate = useCallback((clone) => {
        onElementsChange(prev => [...prev, clone]);
        setSelectedIds([clone.id]);
        if (socketRef.current?.connected) {
            socketRef.current.emit("addElement", { boardId, element: clone });
        }
        pushAction({ type: "ADD_ELEMENT", element: clone });
    }, [boardId, onElementsChange, setSelectedIds, pushAction]);

    useElementKeyboard({ selectedIds, editingId, handleDelete });

    const updateStyle = (patch, persist = true) => {
        if (selectedIds.length === 0) return;
        const beforeElements = elements.filter(el => selectedIds.includes(el.id));
        const updatedElements = elements.map(el => {
            if (selectedIds.includes(el.id)) {
                return { ...el, ...patch };
            }
            return el;
        });
        onElementsChange(updatedElements);

        if (persist) {
            pushAction({
                type: "UPDATE_ELEMENTS",
                before: beforeElements,
                after: updatedElements.filter(el => selectedIds.includes(el.id))
            });
            selectedIds.forEach(id => {
                const el = updatedElements.find(e => e.id === id);
                if (socketRef.current?.connected) {
                    socketRef.current.emit("updateElement", { boardId, element: el });
                }
            });
        }
    };

    // Calculate bounding box of all selected items (not memoized — must update every render during drag)
    let groupBounds = null;
    if (selectedItems.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        selectedItems.forEach(el => {
            const b = getElementBounds(el);
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.w);
            maxY = Math.max(maxY, b.y + b.h);
        });
        groupBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    // Group Transform Handlers
    const { tState, onGroupTransformStart } = useGroupTransform({
        camera,
        elementsRef,
        selectedIdsRef,
        onElementsChange,
        pushAction,
        socket,
        boardId
    });



    const handleSelect = useCallback((id, multi) => {
        if (multi) {
            setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        } else {
            setSelectedIds(prev => {
                if (prev.length === 1 && prev[0] === id) return prev;
                return [id];
            });
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

    return (
        <>
            <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 15, pointerEvents: "none" }}>
                {elements.map(el => (
                    <MemoizedBoardElement
                        key={el.id}
                        el={el}
                        camera={camera}
                        tool={tool}
                        isSelected={selectedIds.includes(el.id)}
                        isMultiSelected={isMultiSelect && selectedIds.includes(el.id)}
                        onSelect={handleSelect}
                        onGroupSelect={onGroupTransformStart}
                        onChange={handleChange}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onDragGuide={setDragGuide}
                        onStartEdit={handleStartEdit}
                        isEditing={el.id === editingId}
                        onEndEdit={handleEndEdit}
                    />
                ))}

                <GhostElement ghost={ghostElement} camera={camera} />

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
                                stroke="#2563eb" strokeWidth="1" strokeDasharray="6 4" opacity="0.4"
                            />
                            <line
                                x1={sx1} y1={sy1} x2={sx2} y2={sy2}
                                stroke="#2563eb" strokeWidth="1.5" strokeDasharray="6 4"
                            />
                            <circle cx={sx1} cy={sy1} r="4" fill="#2563eb" opacity="0.7" />
                            <rect x={midX - 20} y={midY - 11} width="40" height="18" rx="5" fill="#1e40af" opacity="0.85" />
                            <text x={midX} y={midY + 4} textAnchor="middle" fill="white" fontSize="11" fontFamily="monospace" fontWeight="bold">{labelAngle}°</text>
                        </svg>
                    );
                })()}

                {/* Group Selection Box */}
                <GroupSelectionBox
                    selectedIds={selectedIds}
                    groupBounds={groupBounds}
                    tState={tState}
                    camera={camera}
                    editingId={editingId}
                    onGroupTransformStart={onGroupTransformStart}
                    handleSelect={handleSelect}
                    setSelectedIds={setSelectedIds}
                    elementsRef={elementsRef}
                    pointHitsElement={pointHitsElement}
                />
            </div>

            {/* Selection Toolbar */}
            {selectedItems.length > 0 && !editingId && groupBounds && (() => {
                const activeBounds = tState?.groupBounds || groupBounds;
                return (
                    <SelectionToolbar
                        selectedItems={selectedItems}
                        updateStyle={updateStyle}
                        handleDelete={handleDelete}
                        activeBounds={activeBounds}
                        camera={camera}
                        isDark={isDark}
                    />
                );
            })()}
        </>
    );
});
