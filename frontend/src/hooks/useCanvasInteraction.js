import { useState, useRef, useEffect, useCallback } from "react";
import { uid } from "../components/canvas/utils/ids";
import { pointHitsElement, getElementBounds, getPathBounds, boxHitsElement } from "../components/canvas/geometryUtils";
import { eraserHitsElement } from "../components/canvas/utils/eraserMath";
import { DEFAULT_ELEMENT_STYLES } from "../components/canvas/constants";
import { classifyStroke, convertPathToShape } from "../components/canvas/utils/autoShape";
import { createDefaultGraphElement } from "../components/canvas/graph/graphDefaults";

export default function useCanvasInteraction({
    setTool, toolRef,
    isViewerRef,
    color, width,
    isDark,
    setLastShapeType,

    boardStore,
    boardActions,
    setSelectedIds,
    selectionBoxRef, setSelectionBox,
    ghostElement, setGhostElement,
    setPendingEditId,

    setCamera, cameraRef,
    screenToWorld,
    setFollowedUserId,

    me,
    emitCursorMove,
    emitStrokeProgress,
    emitStrokeEnd,

    minimapCanvasRef,
    recordEvent,
    rendererRef,
}) {
    const [currentPath, setCurrentPath] = useState(null);
    const currentPathRef = useRef(null);

    const [eraserPath, setEraserPath] = useState(null);
    const eraserPathRef = useRef(null);
    const isErasingRef = useRef(false);
    const markedForEraseRef = useRef(new Set());

    const [autoShapePreview, setAutoShapePreview] = useState(null);
    const autoShapePreviewRef = useRef(null);
    const holdTimerRef = useRef(null);
    const holdStartPosRef = useRef(null);

    const drawingRef = useRef(false);
    const isPanningRef = useRef(false);
    const lastPointRef = useRef({ x: 0, y: 0 });
    const strokeStartRef = useRef(null);
    const lastCursorRecordRef = useRef(0);

    const getCommittedElements = useCallback(() => {
        return boardStore?.getOrderedElements?.() || [];
    }, [boardStore]);

    const triggerAutoShapeHold = useCallback(() => {
        if (!currentPathRef.current || currentPathRef.current.points.length < 10) return;

        try {
            const detection = classifyStroke(currentPathRef.current.points);
            if (!detection?.kind) return;

            const pathElement = {
                ...currentPathRef.current,
                ...getPathBounds(currentPathRef.current.points),
            };
            const proposed = convertPathToShape(pathElement, detection);
            if (proposed) {
                autoShapePreviewRef.current = proposed;
                setAutoShapePreview(proposed);
            }
        } catch (error) {
            console.error("AutoShape hold error", error);
        }
    }, []);

    useEffect(() => {
        const handleKeys = (e) => {
            if (isViewerRef?.current) return;
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const key = e.key.toLowerCase();
            switch (key) {
                case "v": setTool("select"); break;
                case "h": setTool("hand"); break;
                case "p": setTool("pen"); break;
                case "e": setTool("eraser"); break;
                case "t": setTool("text"); break;
                case "s": setTool("sticky"); setLastShapeType("sticky"); break;
                case "r": setTool("rect"); setLastShapeType("rect"); break;
                case "o": setTool("ellipse"); setLastShapeType("ellipse"); break;
                case "a": setTool("arrow"); setLastShapeType("arrow"); break;
                case "c": setTool("code"); break;
                case "y": setTool("video"); break;
                case "g": setTool("graph"); break;
                case "l": setTool("line"); setLastShapeType("line"); break;
                default: break;
            }
        };
        window.addEventListener("keydown", handleKeys);
        return () => window.removeEventListener("keydown", handleKeys);
    }, [isViewerRef, setLastShapeType, setTool]);

    const getSP = useCallback((e) => {
        const target = e.currentTarget || e.target;
        const rect = target.getBoundingClientRect?.() || { left: 0, top: 0 };
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: cx - rect.left, y: cy - rect.top };
    }, []);

    const handleMinimapPointer = useCallback((e) => {
        const mCanvas = minimapCanvasRef.current;
        if (!mCanvas) return;
        if (e.buttons !== 1 && e.type !== "touchstart" && e.type !== "touchmove") return;

        const rect = mCanvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const mx = cx - rect.left;
        const my = cy - rect.top;

        const elements = getCommittedElements();
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        if (elements.length === 0) {
            minX = -1000;
            minY = -1000;
            maxX = 1000;
            maxY = 1000;
        } else {
            for (const el of elements) {
                const bounds = getElementBounds(el);
                if (bounds.x < minX) minX = bounds.x;
                if (bounds.y < minY) minY = bounds.y;
                if (bounds.x + bounds.w > maxX) maxX = bounds.x + bounds.w;
                if (bounds.y + bounds.h > maxY) maxY = bounds.y + bounds.h;
            }
        }

        const mainW = window.innerWidth;
        const mainH = window.innerHeight;
        const vtl = screenToWorld(0, 0);
        const vbr = screenToWorld(mainW, mainH);
        minX = Math.min(minX, vtl.x) - 200;
        minY = Math.min(minY, vtl.y) - 200;
        maxX = Math.max(maxX, vbr.x) + 200;
        maxY = Math.max(maxY, vbr.y) + 200;

        const bw = maxX - minX;
        const bh = maxY - minY;
        const scale = Math.min(mCanvas.width / bw, mCanvas.height / bh);
        const offX = (mCanvas.width - bw * scale) / 2 - minX * scale;
        const offY = (mCanvas.height - bh * scale) / 2 - minY * scale;

        const twX = (mx - offX) / scale;
        const twY = (my - offY) / scale;
        setCamera((prev) => ({
            ...prev,
            x: mainW / 2 - twX * prev.z,
            y: mainH / 2 - twY * prev.z,
        }));
    }, [getCommittedElements, minimapCanvasRef, screenToWorld, setCamera]);

    const commitElementCreate = useCallback((element) => {
        if (!element?.id || !boardActions) return;
        boardActions.createElement(element);
        recordEvent?.("element.created", element.id, { element });
    }, [boardActions, recordEvent]);

    const findHitElement = useCallback((worldPoint) => {
        const elements = getCommittedElements();
        for (let i = elements.length - 1; i >= 0; i--) {
            if (pointHitsElement(worldPoint.x, worldPoint.y, elements[i], cameraRef.current.z)) {
                return elements[i];
            }
        }
        return undefined;
    }, [getCommittedElements]);

    const onPointerDown = useCallback((e) => {
        if (e.target.closest(".ui-container")) return;
        if (e.target.closest("[data-ui=\"color-menu\"]")) return;

        if (e.pointerId != null) {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        }

        const sp = getSP(e);
        const wp = screenToWorld(sp.x, sp.y);

        if (e.button === 1 || toolRef.current === "hand") {
            setFollowedUserId(null);
            isPanningRef.current = true;
            lastPointRef.current = sp;
            return;
        }

        if (isViewerRef?.current) return;

        const hitEl = findHitElement(wp);
        if (toolRef.current !== "select" || !hitEl) {
            setFollowedUserId(null);
        }

        if (["sticky", "rect", "ellipse", "triangle", "arrow", "line"].includes(toolRef.current)) {
            drawingRef.current = true;
            strokeStartRef.current = wp;
            const defaults = DEFAULT_ELEMENT_STYLES[toolRef.current] || {};
            const darkOverrides = isDark ? { stroke: "#ffffff", color: "#ffffff", textColor: "#ffffff" } : {};
            const toolStyles = { stroke: color, strokeWidth: width };
            if (toolRef.current === "sticky") delete toolStyles.strokeWidth;

            setGhostElement({
                type: toolRef.current,
                x: wp.x,
                y: wp.y,
                w: 0,
                h: 0,
                ...defaults,
                ...toolStyles,
                ...darkOverrides,
                text: "",
                rotation: 0,
            });
            return;
        }

        if (toolRef.current === "select") {
            if (hitEl) {
                if (e.shiftKey) {
                    setSelectedIds((prev) => (
                        prev.includes(hitEl.id)
                            ? prev.filter((id) => id !== hitEl.id)
                            : [...prev, hitEl.id]
                    ));
                } else {
                    setSelectedIds((prev) => (
                        prev.length === 1 && prev[0] === hitEl.id ? prev : [hitEl.id]
                    ));
                }
                return;
            }

            if (!e.shiftKey) setSelectedIds([]);
            selectionBoxRef.current = { x: wp.x, y: wp.y, w: 0, h: 0 };
            setSelectionBox({ ...selectionBoxRef.current });
            return;
        }

        if (toolRef.current === "text") {
            const darkOverrides = isDark ? { stroke: "#ffffff", color: "#ffffff", textColor: "#ffffff" } : {};
            const element = {
                id: uid(),
                type: "text",
                x: wp.x,
                y: wp.y,
                w: 300,
                h: 80,
                ...DEFAULT_ELEMENT_STYLES.text,
                ...darkOverrides,
            };
            commitElementCreate(element);
            setSelectedIds([element.id]);
            setPendingEditId(element.id);
            setTool("select");
            return;
        }

        if (toolRef.current === "code") {
            const element = {
                id: uid(),
                type: "code",
                x: wp.x,
                y: wp.y,
                w: 450,
                h: 300,
                ...DEFAULT_ELEMENT_STYLES.code,
            };
            commitElementCreate(element);
            setSelectedIds([element.id]);
            setTool("select");
            return;
        }

        if (toolRef.current === "video") {
            const element = {
                id: uid(),
                type: "video",
                x: wp.x,
                y: wp.y,
                w: 480,
                h: 320,
                ...DEFAULT_ELEMENT_STYLES.video,
            };
            commitElementCreate(element);
            setSelectedIds([element.id]);
            setTool("select");
            return;
        }

        if (toolRef.current === "graph") {
            const element = createDefaultGraphElement({
                x: wp.x,
                y: wp.y,
                id: uid(),
            });
            commitElementCreate(element);
            setSelectedIds([element.id]);
            setTool("select");
            return;
        }

        if (toolRef.current === "pen") {
            drawingRef.current = true;
            strokeStartRef.current = wp;
            const pressure = e.pressure || 0.5;
            const path = {
                id: uid(),
                type: "path",
                points: [{ x: wp.x, y: wp.y, pressure }],
                color,
                width,
            };

            currentPathRef.current = path;
            setCurrentPath(path);
            recordEvent?.("path.started", path.id, {
                points: path.points,
                color: path.color,
                width: path.width,
            });

            holdStartPosRef.current = { x: wp.x, y: wp.y };
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            holdTimerRef.current = setTimeout(() => triggerAutoShapeHold(), 500);

            emitCursorMove(wp.x, wp.y);
            emitStrokeProgress(path);
            return;
        }

        if (toolRef.current === "eraser") {
            isErasingRef.current = true;
            drawingRef.current = true;
            const path = [wp];
            eraserPathRef.current = path;
            markedForEraseRef.current = new Set();
            setEraserPath([...path]);
            emitCursorMove(wp.x, wp.y);
        }
    }, [
        color,
        commitElementCreate,
        emitCursorMove,
        emitStrokeProgress,
        findHitElement,
        getSP,
        isDark,
        isViewerRef,
        recordEvent,
        screenToWorld,
        selectionBoxRef,
        setFollowedUserId,
        setGhostElement,
        setPendingEditId,
        setSelectedIds,
        setSelectionBox,
        setTool,
        toolRef,
        triggerAutoShapeHold,
        width,
    ]);

    const onPointerMove = useCallback((e) => {
        const sp = getSP(e);
        const wp = screenToWorld(sp.x, sp.y);
        emitCursorMove(wp.x, wp.y);

        if (rendererRef?.current) {
            rendererRef.current.localCursor = {
                tool: toolRef.current,
                x: sp.x,
                y: sp.y,
                width,
                color,
            };
        }

        if (isPanningRef.current) {
            const dx = sp.x - lastPointRef.current.x;
            const dy = sp.y - lastPointRef.current.y;
            setCamera((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            cameraRef.current = { ...cameraRef.current, x: cameraRef.current.x + dx, y: cameraRef.current.y + dy };
            lastPointRef.current = sp;
            return;
        }

        if (selectionBoxRef.current) {
            const origin = selectionBoxRef.current;
            selectionBoxRef.current = {
                ...origin,
                w: wp.x - origin.x,
                h: wp.y - origin.y,
            };
            setSelectionBox({ ...selectionBoxRef.current });
            return;
        }

        if (drawingRef.current && ghostElement) {
            const start = strokeStartRef.current;

            if (ghostElement.type === "arrow" || ghostElement.type === "line") {
                const dx = wp.x - start.x;
                const dy = wp.y - start.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                const mx = (start.x + wp.x) / 2;
                const my = (start.y + wp.y) / 2;
                const height = ghostElement.type === "arrow" ? 40 : 20; // Thinner bounding box for line
                setGhostElement((prev) => ({
                    ...prev,
                    x: mx - dist / 2,
                    y: my - height / 2,
                    w: dist,
                    h: height,
                    rotation: angle,
                }));
                return;
            }

            let rawW = Math.abs(wp.x - start.x);
            let rawH = Math.abs(wp.y - start.y);
            if (e.shiftKey || ghostElement.type === "sticky") {
                const size = Math.max(rawW, rawH);
                rawW = size;
                rawH = size;
            }

            let nextX;
            let nextY;
            let nextW;
            let nextH;

            if (e.altKey) {
                nextW = rawW * 2;
                nextH = rawH * 2;
                nextX = start.x - rawW;
                nextY = start.y - rawH;
            } else {
                nextW = rawW;
                nextH = rawH;
                nextX = wp.x < start.x ? start.x - rawW : start.x;
                nextY = wp.y < start.y ? start.y - rawH : start.y;
            }

            setGhostElement((prev) => ({
                ...prev,
                x: nextX,
                y: nextY,
                w: nextW,
                h: nextH,
            }));
            return;
        }

        if (drawingRef.current && currentPathRef.current) {
            const pressure = e.pressure || 0.5;
            const origin = strokeStartRef.current;
            let point = wp;

            if (e.shiftKey && origin) {
                const dx = wp.x - origin.x;
                const dy = wp.y - origin.y;
                const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
                const dist = Math.sqrt(dx * dx + dy * dy);
                point = {
                    x: origin.x + Math.cos(angle) * dist,
                    y: origin.y + Math.sin(angle) * dist,
                };
            }

            currentPathRef.current.points.push({ x: point.x, y: point.y, pressure });
            setCurrentPath({ ...currentPathRef.current });
            emitStrokeProgress(currentPathRef.current);

            recordEvent?.("path.appended", currentPathRef.current.id, {
                newPoint: { x: point.x, y: point.y, pressure },
            });

            if (holdStartPosRef.current) {
                const dx = wp.x - holdStartPosRef.current.x;
                const dy = wp.y - holdStartPosRef.current.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 12) {
                    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
                    holdStartPosRef.current = { x: wp.x, y: wp.y };
                    if (autoShapePreviewRef.current) {
                        autoShapePreviewRef.current = null;
                        setAutoShapePreview(null);
                    }
                    holdTimerRef.current = setTimeout(() => triggerAutoShapeHold(), 500);
                }
            }
            return;
        }

        if (isErasingRef.current && eraserPathRef.current) {
            const elements = getCommittedElements();
            const prevPoint = eraserPathRef.current[eraserPathRef.current.length - 1];
            eraserPathRef.current.push(wp);
            setEraserPath([...eraserPathRef.current]);

            // AABB of the eraser segment for cheap pre-filter
            const segMinX = Math.min(prevPoint.x, wp.x) - 20;
            const segMinY = Math.min(prevPoint.y, wp.y) - 20;
            const segMaxX = Math.max(prevPoint.x, wp.x) + 20;
            const segMaxY = Math.max(prevPoint.y, wp.y) + 20;

            const nextMarkedIds = new Set(markedForEraseRef.current);
            let changed = false;
            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];
                if (nextMarkedIds.has(element.id)) continue;
                // Cheap AABB rejection: skip elements clearly out of range
                const b = element.type === "path"
                    ? getPathBounds(element.points || [])
                    : { x: element.x || 0, y: element.y || 0, w: element.w || 0, h: element.h || 0 };
                if (b.x + b.w < segMinX || b.x > segMaxX || b.y + b.h < segMinY || b.y > segMaxY) continue;
                if (eraserHitsElement(prevPoint.x, prevPoint.y, wp.x, wp.y, element)) {
                    nextMarkedIds.add(element.id);
                    changed = true;
                }
            }
            if (changed) {
                markedForEraseRef.current = nextMarkedIds;
                rendererRef?.current?.setHiddenElementIds(Array.from(nextMarkedIds));
            }
        }
    }, [
        cameraRef,
        color,
        emitCursorMove,
        emitStrokeProgress,
        getCommittedElements,
        getSP,
        ghostElement,
        me?.avatar,
        me?.id,
        me?.name,
        me?.userId,
        recordEvent,
        rendererRef,
        screenToWorld,
        selectionBoxRef,
        setCamera,
        setGhostElement,
        setSelectionBox,
        toolRef,
        triggerAutoShapeHold,
        width,
    ]);

    const onPointerUp = useCallback((e) => {
        if (selectionBoxRef.current) {
            const box = selectionBoxRef.current;
            const x1 = Math.min(box.x, box.x + box.w);
            const y1 = Math.min(box.y, box.y + box.h);
            const x2 = Math.max(box.x, box.x + box.w);
            const y2 = Math.max(box.y, box.y + box.h);

            const isClick = Math.abs(box.w) < 3 && Math.abs(box.h) < 3;
            let hits;

            if (isClick) {
                // Single click — use precise stroke hit detection
                const hitEl = findHitElement({ x: box.x, y: box.y });
                hits = hitEl ? [hitEl.id] : [];
            } else {
                // Actual drag marquee — use bounding-box overlap and hollow-shape rejection
                hits = getCommittedElements()
                    .filter((el) => boxHitsElement(x1, y1, x2, y2, el))
                    .map((el) => el.id);
            }

            if (e.shiftKey) {
                setSelectedIds((prev) => [...new Set([...prev, ...hits])]);
            } else {
                setSelectedIds(hits);
            }

            selectionBoxRef.current = null;
            setSelectionBox(null);
            return;
        }

        if (isPanningRef.current) {
            isPanningRef.current = false;
            return;
        }

        if (drawingRef.current && ghostElement) {
            const element = { ...ghostElement, id: uid() };
            if (element.w > 5 || element.h > 5) {
                commitElementCreate(element);
                setSelectedIds([element.id]);
            }
            setGhostElement(null);
            drawingRef.current = false;
            setTool("select");
            return;
        }

        if (drawingRef.current && currentPathRef.current) {
            const path = currentPathRef.current;
            currentPathRef.current = null;
            setCurrentPath(null);
            drawingRef.current = false;
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
            emitStrokeEnd();
            recordEvent?.("path.finished", path.id, {});

            if (autoShapePreviewRef.current) {
                const element = {
                    ...autoShapePreviewRef.current,
                    userId: me?.userId || me?.id,
                };
                commitElementCreate(element);
                setAutoShapePreview(null);
                autoShapePreviewRef.current = null;
                return;
            }

            if (path?.points?.length > 0) {
                const bounds = getPathBounds(path.points);
                const element = {
                    ...path,
                    ...bounds,
                    userId: me?.userId || me?.id,
                };
                commitElementCreate(element);
            }
            return;
        }

        if (isErasingRef.current) {
            isErasingRef.current = false;
            eraserPathRef.current = null;
            setEraserPath(null);

            const idsToDelete = Array.from(markedForEraseRef.current);
            if (idsToDelete.length > 0) {
                boardActions?.deleteElements(idsToDelete);
                idsToDelete.forEach((id) => recordEvent?.("element.deleted", id, {}));
            }
            markedForEraseRef.current = new Set();
            rendererRef?.current?.setHiddenElementIds([]);
            drawingRef.current = false;
            return;
        }

        drawingRef.current = false;
        emitStrokeEnd();
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
    }, [
        boardActions,
        commitElementCreate,
        emitStrokeEnd,
        findHitElement,
        getCommittedElements,
        ghostElement,
        me?.id,
        me?.userId,
        recordEvent,
        rendererRef,
        selectionBoxRef,
        setGhostElement,
        setSelectedIds,
        setSelectionBox,
        setTool,
    ]);

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        currentPath,
        eraserPath,
        handleMinimapPointer,
        autoShapePreview,
    };
}
