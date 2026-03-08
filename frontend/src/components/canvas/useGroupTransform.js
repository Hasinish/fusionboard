import { useState, useRef, useEffect } from "react";
import { getElementBounds, getPathBounds } from "./geometryUtils";

export function useGroupTransform({
    camera,
    elementsRef,
    selectedIdsRef,
    onElementsChange,
    pushAction,
    socket,
    boardId
}) {
    const [tState, setTState] = useState(null);
    const tStateRef = useRef(null);
    const socketRef = useRef(socket);
    const lastGroupEmitRef = useRef(0);

    useEffect(() => {
        socketRef.current = socket;
    }, [socket]);

    const onGroupTransformStart = (type, e) => {
        e.stopPropagation();
        e.preventDefault();
        const startX = (e.clientX - camera.x) / camera.z;
        const startY = (e.clientY - camera.y) / camera.z;

        // Use refs to get absolute latest state, avoiding stale closure issues
        const currentElements = elementsRef.current;
        const currentSelectedIds = selectedIdsRef.current;
        const initialElements = currentElements
            .filter(el => currentSelectedIds.includes(el.id))
            .map(el => ({ ...el }));

        if (initialElements.length === 0) return;

        // Re-calculate group bounds from the absolute latest elements
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        initialElements.forEach(el => {
            const b = getElementBounds(el);
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.w);
            maxY = Math.max(maxY, b.y + b.h);
        });
        const currentGroupBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

        const newState = { type, startX, startY, initialElements, groupBounds: currentGroupBounds };
        setTState(newState);
        tStateRef.current = newState;
    };

    // Use a ref-based approach so the window listeners always call the latest version
    const onGroupTransformMoveRef = useRef(null);
    const onGroupTransformEndRef = useRef(null);

    // Update the move handler ref on every render so it always has fresh camera/state
    onGroupTransformMoveRef.current = (e) => {
        if (!tStateRef.current) return;
        const { type, startX, startY, initialElements, groupBounds: startBounds } = tStateRef.current;
        const currentX = (e.clientX - camera.x) / camera.z;
        const currentY = (e.clientY - camera.y) / camera.z;

        const centerX = startBounds.x + startBounds.w / 2;
        const centerY = startBounds.y + startBounds.h / 2;

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
            setTState(prev => ({
                ...prev,
                groupBounds: {
                    ...startBounds,
                    x: startBounds.x + dx,
                    y: startBounds.y + dy
                }
            }));
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

                const newRotation = (el.rotation || 0) + deltaAngle * (180 / Math.PI);

                if (el.type === "path") {
                    // Path points MUST be shifted so the hit detection (pointHitsElement)
                    // stays in sync with the visual div (rotated selection box).
                    const dx = newCX - (el.x + el.w / 2);
                    const dy = newCY - (el.y + el.h / 2);
                    const newPoints = el.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                    return {
                        ...el,
                        points: newPoints,
                        x: newCX - el.w / 2,
                        y: newCY - el.h / 2,
                        rotation: newRotation,
                    };
                }

                return {
                    ...el,
                    x: newCX - el.w / 2,
                    y: newCY - el.h / 2,
                    rotation: newRotation
                };
            });
        } else if (type.startsWith("scale")) {
            const corner = type.replace("scale-", "");
            const dw = currentX - startX;
            const dh = currentY - startY;

            let sw = 1, sh = 1;
            if (corner.includes("e")) sw = Math.max(0.1, (startBounds.w + dw) / startBounds.w);
            if (corner.includes("w")) sw = Math.max(0.1, (startBounds.w - dw) / startBounds.w);
            if (corner.includes("s")) sh = Math.max(0.1, (startBounds.h + dh) / startBounds.h);
            if (corner.includes("n")) sh = Math.max(0.1, (startBounds.h - dh) / startBounds.h);

            if (e.shiftKey) {
                const ratio = Math.max(sw, sh);
                sw = ratio; sh = ratio;
            }

            const anchorX = corner.includes("w") ? startBounds.x + startBounds.w : startBounds.x;
            const anchorY = corner.includes("n") ? startBounds.y + startBounds.h : startBounds.y;

            updated = initialElements.map(el => {
                const elX = anchorX + (el.x - anchorX) * sw;
                const elY = anchorY + (el.y - anchorY) * sh;
                const elW = el.w * sw;
                const elH = el.h * sh;

                if (el.type === "path") {
                    const newPoints = el.points.map(p => ({
                        x: anchorX + (p.x - anchorX) * sw,
                        y: anchorY + (p.y - anchorY) * sh,
                        pressure: p.pressure
                    }));
                    const bounds = getPathBounds(newPoints);
                    return {
                        ...el,
                        points: newPoints,
                        ...bounds
                    };
                }

                return { ...el, x: elX, y: elY, w: elW, h: elH };
            });

            setTState(prev => ({
                ...prev,
                groupBounds: {
                    ...startBounds,
                    x: corner.includes("w") ? startBounds.x + dw : startBounds.x,
                    y: corner.includes("n") ? startBounds.y + dh : startBounds.y,
                    w: corner.includes("w") ? startBounds.w - dw : (corner.includes("e") ? startBounds.w + dw : startBounds.w),
                    h: corner.includes("n") ? startBounds.h - dh : (corner.includes("s") ? startBounds.h + dh : startBounds.h),
                }
            }));
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
        }
    };

    // Update the end handler ref on every render
    onGroupTransformEndRef.current = () => {
        if (!tStateRef.current) return;
        const { initialElements } = tStateRef.current;
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

        setTState(null);
        tStateRef.current = null;
    };

    // Attach stable wrapper functions that delegate to refs — listeners never go stale
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

    return { tState, onGroupTransformStart };
}
