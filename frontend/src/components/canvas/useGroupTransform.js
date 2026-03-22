import { useState, useRef, useEffect } from "react";
import { getElementBounds, getPathBounds } from "./geometryUtils";

export function useGroupTransform({
    camera,
    elementsRef,
    selectedIds,
    selectedIdsRef,
    onElementsChange,
    pushAction,
    socket,
    boardId,
    yElements
}) {
    const [tState, setTState] = useState(null);
    const [selectionBounds, setSelectionBounds] = useState(null); // { x, y, w, h } in world space
    const [selectionRotation, setSelectionRotation] = useState(0); 
    const tStateRef = useRef(null);
    const selectionBoundsRef = useRef(null);
    const prevSelectedRef = useRef(""); 

    const socketRef = useRef(socket);
    const lastGroupEmitRef = useRef(0);

    useEffect(() => {
        socketRef.current = socket;
    }, [socket]);

    // Recompute bounds immediately whenever selected elements change
    useEffect(() => {
        if (!selectedIds || selectedIds.length <= 1) {
            selectionBoundsRef.current = null;
            setSelectionBounds(null);
            setSelectionRotation(0);
            prevSelectedRef.current = "";
            return;
        }

        const selKey = [...selectedIds].sort().join(",");
        if (selKey === prevSelectedRef.current) return; // same set, keep existing
        prevSelectedRef.current = selKey;

        const selected = elementsRef.current.filter(el => selectedIds.includes(el.id));
        if (!selected.length) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const el of selected) {
            const b = getElementBounds(el);
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.w);
            maxY = Math.max(maxY, b.y + b.h);
        }
        const bounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        selectionBoundsRef.current = bounds;
        setSelectionBounds(bounds);
        setSelectionRotation(0); // fresh selection always resets rotation
    }, [selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

    const onGroupTransformStart = (type, e) => {
        e.stopPropagation();
        e.preventDefault();
        const startX = (e.clientX - camera.x) / camera.z;
        const startY = (e.clientY - camera.y) / camera.z;

        const currentElements = elementsRef.current;
        const currentSelectedIds = selectedIdsRef.current;
        const initialElements = currentElements
            .filter(el => currentSelectedIds.includes(el.id))
            .map(el => ({ ...el }));

        if (initialElements.length === 0) return;

        let startGroupBounds;
        if ((type === "rotate" || type === "move") && selectionBoundsRef.current) {
            startGroupBounds = selectionBoundsRef.current;
        } else {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            initialElements.forEach(el => {
                const b = getElementBounds(el);
                minX = Math.min(minX, b.x);
                minY = Math.min(minY, b.y);
                maxX = Math.max(maxX, b.x + b.w);
                maxY = Math.max(maxY, b.y + b.h);
            });
            startGroupBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        }

        const newState = { 
            type, 
            startX, 
            startY, 
            initialElements, 
            startGroupBounds, 
            groupBounds: startGroupBounds, 
            currentRotation: 0 
        };
        setTState(newState);
        tStateRef.current = newState;
    };

    const onGroupTransformMoveRef = useRef(null);
    const onGroupTransformEndRef = useRef(null);

    onGroupTransformMoveRef.current = (e) => {
        if (!tStateRef.current) return;
        const { type, startX, startY, initialElements, startGroupBounds } = tStateRef.current;
        const currentX = (e.clientX - camera.x) / camera.z;
        const currentY = (e.clientY - camera.y) / camera.z;

        const centerX = startGroupBounds.x + startGroupBounds.w / 2;
        const centerY = startGroupBounds.y + startGroupBounds.h / 2;

        let updated;
        if (type === "move") {
            const dx = currentX - startX;
            const dy = currentY - startY;
            updated = initialElements.map(el => {
                if (el.type === "path") {
                    const newPoints = el.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                    const bounds = getPathBounds(newPoints);
                    return { ...el, points: newPoints, ...bounds };
                }
                return { ...el, x: el.x + dx, y: el.y + dy };
            });
            const newBounds = {
                ...startGroupBounds,
                x: startGroupBounds.x + dx,
                y: startGroupBounds.y + dy
            };
            setTState(prev => ({
                ...prev,
                groupBounds: newBounds
            }));
            tStateRef.current = { ...tStateRef.current, groupBounds: newBounds };
        } else if (type === "rotate") {
            const startAngle = Math.atan2(startY - centerY, startX - centerX);
            let currentAngle = Math.atan2(currentY - centerY, currentX - centerX);

            if (e.shiftKey) {
                const snap = Math.PI / 12; // 15 degrees
                currentAngle = Math.round(currentAngle / snap) * snap;
            }
            const deltaAngle = currentAngle - startAngle;
            const deltaDeg = deltaAngle * (180 / Math.PI);
            
            setTState(prev => ({ ...prev, currentRotation: deltaDeg }));
            tStateRef.current = { ...tStateRef.current, currentRotation: deltaDeg };
 
            updated = initialElements.map(el => {
                const elCX = el.x + el.w / 2;
                const elCY = el.y + el.h / 2;
                const dx = elCX - centerX;
                const dy = elCY - centerY;
                const cos = Math.cos(deltaAngle);
                const sin = Math.sin(deltaAngle);
                const rx = dx * cos - dy * sin;
                const ry = dx * sin + dy * cos;
                const newCX = centerX + rx;
                const newCY = centerY + ry;
                const newRotation = (el.rotation || 0) + deltaDeg;

                if (el.type === "path") {
                    const localDx = newCX - (el.x + el.w / 2);
                    const localDy = newCY - (el.y + el.h / 2);
                    const newPoints = el.points.map(p => ({ x: p.x + localDx, y: p.y + localDy }));
                    return { ...el, points: newPoints, x: newCX - el.w / 2, y: newCY - el.h / 2, rotation: newRotation };
                }
                return { ...el, x: newCX - el.w / 2, y: newCY - el.h / 2, rotation: newRotation };
            });
        } else if (type.startsWith("scale")) {
            const corner = type.replace("scale-", "");
            let dw = currentX - startX;
            let dh = currentY - startY;

            if (selectionRotation) {
                const rad = (-selectionRotation * Math.PI) / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                const lX = dw * cos - dh * sin;
                const lY = dw * sin + dh * cos;
                dw = lX; dh = lY;
            }

            const isAlt = e.altKey;
            let sw = 1, sh = 1;
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
                sw = ratio; sh = ratio;
            }

            const anchorX = isAlt ? centerX : (corner.includes("w") ? startGroupBounds.x + startGroupBounds.w : startGroupBounds.x);
            const anchorY = isAlt ? centerY : (corner.includes("n") ? startGroupBounds.y + startGroupBounds.h : startGroupBounds.y);

            updated = initialElements.map(el => {
                const elCX = el.x + el.w / 2;
                const elCY = el.y + el.h / 2;
                const dx = elCX - anchorX;
                const dy = elCY - anchorY;
                const rad = (-selectionRotation * Math.PI) / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                const localX = dx * cos - dy * sin;
                const localY = dx * sin + dy * cos;
                const sLocalX = localX * sw;
                const sLocalY = localY * sh;
                const rCos = Math.cos(-rad), rSin = Math.sin(-rad);
                const worldX = anchorX + (sLocalX * rCos - sLocalY * rSin);
                const worldY = anchorY + (sLocalX * rSin + sLocalY * rCos);
                const elW = el.w * sw;
                const elH = el.h * sh;

                if (el.type === "path") {
                    const newPoints = el.points.map(p => {
                        const pdx = p.x - anchorX;
                        const pdy = p.y - anchorY;
                        const plX = pdx * cos - pdy * sin;
                        const plY = pdx * sin + pdy * cos;
                        const splX = plX * sw;
                        const splY = plY * sh;
                        return { x: anchorX + (splX * rCos - splY * rSin), y: anchorY + (splX * rSin + splY * rCos), pressure: p.pressure };
                    });
                    const bounds = getPathBounds(newPoints);
                    return { ...el, points: newPoints, ...bounds };
                }
                return { ...el, x: worldX - elW / 2, y: worldY - elH / 2, w: elW, h: elH };
            });

            const newBounds = {
                x: anchorX + (startGroupBounds.x - anchorX) * (sw || 0.01),
                y: anchorY + (startGroupBounds.y - anchorY) * (sh || 0.01),
                w: startGroupBounds.w * sw,
                h: startGroupBounds.h * sh
            };
            setTState(prev => ({
                ...prev,
                groupBounds: newBounds
            }));
            tStateRef.current = { ...tStateRef.current, groupBounds: newBounds };
        }

        if (updated) {
            onElementsChange(prev => {
                const map = new Map(prev.map(p => [p.id, p]));
                updated.forEach(u => map.set(u.id, u));
                return Array.from(map.values());
            });
            if (socketRef.current?.connected) {
                const now = Date.now();
                if (now - lastGroupEmitRef.current > 40) {
                    socketRef.current.emit("updateElements", { boardId, elements: updated });
                    lastGroupEmitRef.current = now;
                }
            }
            if (yElements && updated) {
                yElements.doc.transact(() => {
                    updated.forEach(el => yElements.set(el.id, el));
                });
            }
        }
    };

    onGroupTransformEndRef.current = () => {
        if (!tStateRef.current) return;
        const { type, currentRotation, groupBounds, initialElements } = tStateRef.current;

        if (type === "rotate") {
            setSelectionRotation(prev => prev + (currentRotation || 0));
        } else if ((type === "move" || type.startsWith("scale")) && groupBounds) {
            selectionBoundsRef.current = groupBounds;
            setSelectionBounds(groupBounds);
        }

        const currentSelectedIds = selectedIdsRef.current;
        const currentElements = elementsRef.current.filter(el => currentSelectedIds.includes(el.id));

        pushAction({
            type: "UPDATE_ELEMENTS",
            before: initialElements,
            after: currentElements
        });

        if (socketRef.current?.connected) {
            socketRef.current.emit("updateElements", { boardId, elements: currentElements });
        }
        if (yElements && currentElements.length > 0) {
            yElements.doc.transact(() => {
                currentElements.forEach(el => yElements.set(el.id, el));
            });
        }

        prevSelectedRef.current = [...selectedIdsRef.current].sort().join(",");
        setTState(null);
        tStateRef.current = null;
    };

    useEffect(() => {
        if (!tState) return;
        const moveHandler = (e) => onGroupTransformMoveRef.current?.(e);
        const endHandler = (e) => onGroupTransformEndRef.current?.(e);
        window.addEventListener("pointermove", moveHandler);
        window.addEventListener("pointerup", endHandler);
        return () => {
            window.removeEventListener("pointermove", moveHandler);
            window.removeEventListener("pointerup", endHandler);
        };
    }, [tState]);

    return { 
        tState, 
        selectionBounds, 
        selectionRotation, 
        onGroupTransformStart 
    };
}
