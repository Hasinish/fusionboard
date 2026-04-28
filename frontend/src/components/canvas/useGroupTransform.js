import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { getElementBounds, getPathBounds } from "./geometryUtils";

function computeBounds(elements) {
    if (!elements.length) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach((element) => {
        const bounds = getElementBounds(element);
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.w);
        maxY = Math.max(maxY, bounds.y + bounds.h);
    });

    return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
    };
}

export function useGroupTransform({
    camera,
    boardActions,
    selectedIds,
    selectedIdsRef,
    selectedElements,
    onPreviewElementsChange,
    recordEvent,
}) {
    const [tState, setTState] = useState(null);

    const tStateRef = useRef(null);
    const selectionBoundsRef = useRef(null);
    const selectionBounds = useMemo(() => {
        if (!selectedIds?.length || !selectedElements.length) return null;
        return computeBounds(selectedElements);
    }, [selectedElements, selectedIds]);
    const baseSelectionRotation = useMemo(() => {
        if (!selectedIds?.length || !selectedElements.length) return 0;
        const firstRotation = selectedElements[0]?.rotation || 0;
        const isUniformRotation = selectedElements.every(
            (element) => Math.abs((element.rotation || 0) - firstRotation) < 0.001
        );
        return isUniformRotation ? firstRotation : 0;
    }, [selectedElements, selectedIds]);

    const selectionRotation = tState?.type === "rotate"
        ? (tState.startSelectionRotation || 0) + (tState.currentRotation || 0)
        : baseSelectionRotation;

    useEffect(() => {
        selectionBoundsRef.current = selectionBounds;
    }, [selectionBounds]);

    const onGroupTransformStart = useCallback((type, e) => {
        e.stopPropagation();
        e.preventDefault();

        const startX = (e.clientX - camera.x) / camera.z;
        const startY = (e.clientY - camera.y) / camera.z;
        const initialElements = selectedElements.map((element) => ({ ...element }));
        if (!initialElements.length) return;

        const startGroupBounds =
            (type === "rotate" || type === "move") && selectionBoundsRef.current
                ? selectionBoundsRef.current
                : computeBounds(initialElements);

        const nextState = {
            type,
            startX,
            startY,
            initialElements,
            startGroupBounds,
            groupBounds: startGroupBounds,
            currentRotation: 0,
            startSelectionRotation: baseSelectionRotation,
            updatedElements: initialElements,
        };

        setTState(nextState);
        tStateRef.current = nextState;
    }, [camera.x, camera.y, camera.z, selectedElements]);

    const handleGroupTransformMove = useCallback((e) => {
        if (!tStateRef.current) return;

        const { type, startX, startY, initialElements, startGroupBounds } = tStateRef.current;
        const currentX = (e.clientX - camera.x) / camera.z;
        const currentY = (e.clientY - camera.y) / camera.z;
        const centerX = startGroupBounds.x + startGroupBounds.w / 2;
        const centerY = startGroupBounds.y + startGroupBounds.h / 2;

        let updated = null;

        if (type === "move") {
            const dx = currentX - startX;
            const dy = currentY - startY;
            updated = initialElements.map((element) => {
                if (element.type === "path") {
                    const newPoints = element.points.map((point) => ({
                        x: point.x + dx,
                        y: point.y + dy,
                        pressure: point.pressure,
                    }));
                    return {
                        ...element,
                        points: newPoints,
                        ...getPathBounds(newPoints),
                    };
                }
                return { ...element, x: element.x + dx, y: element.y + dy };
            });

            const nextBounds = {
                ...startGroupBounds,
                x: startGroupBounds.x + dx,
                y: startGroupBounds.y + dy,
            };
            setTState((prev) => ({ ...prev, groupBounds: nextBounds }));
            tStateRef.current = { ...tStateRef.current, groupBounds: nextBounds };
        } else if (type === "rotate") {
            const startAngle = Math.atan2(startY - centerY, startX - centerX);
            let currentAngle = Math.atan2(currentY - centerY, currentX - centerX);
            if (e.shiftKey) {
                const snap = Math.PI / 12;
                currentAngle = Math.round(currentAngle / snap) * snap;
            }

            const deltaAngle = currentAngle - startAngle;
            const deltaDeg = deltaAngle * (180 / Math.PI);

            updated = initialElements.map((element) => {
                const elementCenterX = element.x + element.w / 2;
                const elementCenterY = element.y + element.h / 2;
                const dx = elementCenterX - centerX;
                const dy = elementCenterY - centerY;
                const cos = Math.cos(deltaAngle);
                const sin = Math.sin(deltaAngle);
                const rx = dx * cos - dy * sin;
                const ry = dx * sin + dy * cos;
                const nextCenterX = centerX + rx;
                const nextCenterY = centerY + ry;
                const nextRotation = (element.rotation || 0) + deltaDeg;

                if (element.type === "path") {
                    const localDx = nextCenterX - (element.x + element.w / 2);
                    const localDy = nextCenterY - (element.y + element.h / 2);
                    const nextPoints = element.points.map((point) => ({
                        x: point.x + localDx,
                        y: point.y + localDy,
                        pressure: point.pressure,
                    }));
                    return {
                        ...element,
                        points: nextPoints,
                        x: nextCenterX - element.w / 2,
                        y: nextCenterY - element.h / 2,
                        rotation: nextRotation,
                    };
                }

                return {
                    ...element,
                    x: nextCenterX - element.w / 2,
                    y: nextCenterY - element.h / 2,
                    rotation: nextRotation,
                };
            });

            setTState((prev) => ({ ...prev, currentRotation: deltaDeg }));
            tStateRef.current = { ...tStateRef.current, currentRotation: deltaDeg };
        } else if (type.startsWith("scale")) {
            const corner = type.replace("scale-", "");
            let dw = currentX - startX;
            let dh = currentY - startY;

            if (selectionRotation) {
                const rad = (-selectionRotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const localX = dw * cos - dh * sin;
                const localY = dw * sin + dh * cos;
                dw = localX;
                dh = localY;
            }

            const isAlt = e.altKey;
            let sw = 1;
            let sh = 1;

            if (isAlt) {
                if (corner.includes("e")) sw = Math.max(0.01, (startGroupBounds.w + 2 * dw) / startGroupBounds.w);
                else if (corner.includes("w")) sw = Math.max(0.01, (startGroupBounds.w - 2 * dw) / startGroupBounds.w);

                if (corner.includes("s")) sh = Math.max(0.01, (startGroupBounds.h + 2 * dh) / startGroupBounds.h);
                else if (corner.includes("n")) sh = Math.max(0.01, (startGroupBounds.h - 2 * dh) / startGroupBounds.h);
            } else {
                if (corner.includes("e")) sw = Math.max(0.01, (startGroupBounds.w + dw) / startGroupBounds.w);
                if (corner.includes("w")) sw = Math.max(0.1, (startGroupBounds.w - dw) / startGroupBounds.w);
                if (corner.includes("s")) sh = Math.max(0.01, (startGroupBounds.h + dh) / startGroupBounds.h);
                if (corner.includes("n")) sh = Math.max(0.1, (startGroupBounds.h - dh) / startGroupBounds.h);
            }

            if (e.shiftKey) {
                const ratio = Math.max(sw, sh);
                sw = ratio;
                sh = ratio;
            }

            const anchorX = isAlt
                ? centerX
                : (corner.includes("w") ? startGroupBounds.x + startGroupBounds.w : startGroupBounds.x);
            const anchorY = isAlt
                ? centerY
                : (corner.includes("n") ? startGroupBounds.y + startGroupBounds.h : startGroupBounds.y);

            updated = initialElements.map((element) => {
                const elementCenterX = element.x + element.w / 2;
                const elementCenterY = element.y + element.h / 2;
                const dx = elementCenterX - anchorX;
                const dy = elementCenterY - anchorY;
                const rad = (-selectionRotation * Math.PI) / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const localX = dx * cos - dy * sin;
                const localY = dx * sin + dy * cos;
                const scaledLocalX = localX * sw;
                const scaledLocalY = localY * sh;
                const restoreCos = Math.cos(-rad);
                const restoreSin = Math.sin(-rad);
                const worldX = anchorX + (scaledLocalX * restoreCos - scaledLocalY * restoreSin);
                const worldY = anchorY + (scaledLocalX * restoreSin + scaledLocalY * restoreCos);
                const nextW = element.w * sw;
                const nextH = element.h * sh;

                if (element.type === "path") {
                    const nextPoints = element.points.map((point) => {
                        const pdx = point.x - anchorX;
                        const pdy = point.y - anchorY;
                        const localPointX = pdx * cos - pdy * sin;
                        const localPointY = pdy * cos + pdx * sin;
                        const scaledPointX = localPointX * sw;
                        const scaledPointY = localPointY * sh;
                        return {
                            x: anchorX + (scaledPointX * restoreCos - scaledPointY * restoreSin),
                            y: anchorY + (scaledPointX * restoreSin + scaledPointY * restoreCos),
                            pressure: point.pressure,
                        };
                    });
                    return {
                        ...element,
                        points: nextPoints,
                        ...getPathBounds(nextPoints),
                    };
                }

                return {
                    ...element,
                    x: worldX - nextW / 2,
                    y: worldY - nextH / 2,
                    w: nextW,
                    h: nextH,
                };
            });

            const nextBounds = {
                x: anchorX + (startGroupBounds.x - anchorX) * (sw || 0.01),
                y: anchorY + (startGroupBounds.y - anchorY) * (sh || 0.01),
                w: startGroupBounds.w * sw,
                h: startGroupBounds.h * sh,
            };
            setTState((prev) => ({ ...prev, groupBounds: nextBounds }));
            tStateRef.current = { ...tStateRef.current, groupBounds: nextBounds };
        }

        if (updated) {
            tStateRef.current = { ...tStateRef.current, updatedElements: updated };
            // Local preview for smooth UI overlay
            onPreviewElementsChange(updated);
            // Real-time broadcast without cluttering Undo/Redo
            boardActions?.updateElements(updated, { origin: "DRAG_PREVIEW" });
        }
    }, [boardActions, camera.x, camera.y, camera.z, onPreviewElementsChange, selectionRotation]);

    const handleGroupTransformEnd = useCallback(() => {
        if (!tStateRef.current) return;

        const { updatedElements } = tStateRef.current;

        const selectedIdSet = new Set(selectedIdsRef.current);
        const committedElements = (updatedElements || []).filter((element) => selectedIdSet.has(element.id));
        if (committedElements.length > 0) {
            boardActions?.updateElements(committedElements);
            committedElements.forEach((element) => {
                recordEvent?.("element.updated", element.id, { element, persist: true });
            });
        }

        onPreviewElementsChange([]);
        setTState(null);
        tStateRef.current = null;
    }, [boardActions, onPreviewElementsChange, recordEvent, selectedIdsRef]);

    useEffect(() => {
        if (!tState) return;

        window.addEventListener("pointermove", handleGroupTransformMove);
        window.addEventListener("pointerup", handleGroupTransformEnd);

        return () => {
            window.removeEventListener("pointermove", handleGroupTransformMove);
            window.removeEventListener("pointerup", handleGroupTransformEnd);
        };
    }, [handleGroupTransformEnd, handleGroupTransformMove, tState]);

    return {
        tState,
        selectionBounds,
        selectionRotation,
        onGroupTransformStart,
    };
}
