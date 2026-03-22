import { useState, useRef, useEffect, useCallback } from "react";
import { uid } from "../components/canvas/utils/ids";
import { pointHitsElement, getElementBounds, getPathBounds } from "../components/canvas/geometryUtils";
import { eraserHitsElement } from "../components/canvas/utils/eraserMath";
import { DEFAULT_ELEMENT_STYLES } from "../components/canvas/constants";
import { classifyStroke, convertPathToShape } from "../components/canvas/utils/autoShape";
import { createDefaultGraphElement } from "../components/canvas/graph/graphDefaults";

/**
 * useCanvasInteraction
 * Handles pointer events, tool-specific logic, and drawing state.
 */
export default function useCanvasInteraction({
    // Tool state
    tool, setTool, toolRef,
    isViewerRef,
    color, width,
    isDark,
    lastShapeType, setLastShapeType,
    
    // Elements state
    elementsRef, setElements,
    selectedIds, setSelectedIds,
    selectionBoxRef, setSelectionBox,
    ghostElement, setGhostElement,
    pushAction,
    setPendingEditId,
    
    // Camera state
    camera, setCamera, cameraRef,
    targetCameraRef, startCameraAnimation,
    screenToWorld,
    setFollowedUserId,
    
    // Realtime / Socket
    socket, boardId, me,
    emitCursorMove,
    setMousePos,
    
    // Minimap Ref for interaction
    minimapCanvasRef,

    // Recording
    recordEvent,

    // Canvas renderer
    rendererRef,

    // Yjs
    yElements
}) {
    // In-progress pen stroke (vector preview)
    const [currentPath, setCurrentPath] = useState(null);
    const currentPathRef = useRef(null);

    // Eraser state
    const [eraserPath, setEraserPath] = useState(null);
    const eraserPathRef = useRef(null);
    const isErasingRef = useRef(false);

    // Samsung-style Hold-to-Shape state
    const [autoShapePreview, setAutoShapePreview] = useState(null);
    const autoShapePreviewRef = useRef(null);
    const holdTimerRef = useRef(null);
    const holdStartPosRef = useRef(null);

    // Interaction refs
    const drawingRef = useRef(false);
    const isPanningRef = useRef(false);
    const lastPointRef = useRef({ x: 0, y: 0 });
    const strokeStartRef = useRef(null);
    const lastEmittedTimeRef = useRef(0);
    const lastCursorRecordRef = useRef(0);

    // Tool shortcuts
    useEffect(() => {
        const handleKeys = (e) => {
            if (isViewerRef?.current) return;
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const key = e.key.toLowerCase();
            switch (key) {
                case 'v': setTool("select"); break;
                case 'h': setTool("hand"); break;
                case 'p': setTool("pen"); break;
                case 'e': setTool("eraser"); break;
                case 't': setTool("text"); break;
                case 's': setTool("sticky"); setLastShapeType("sticky"); break;
                case 'r': setTool("rect"); setLastShapeType("rect"); break;
                case 'o': setTool("ellipse"); setLastShapeType("ellipse"); break;
                case 'a': setTool("arrow"); setLastShapeType("arrow"); break;
                case 'c': setTool("code"); break;
                case 'y': setTool("video"); break;
                case 'g': setTool("graph"); break;
                default: break;
            }
        };
        window.addEventListener("keydown", handleKeys);
        return () => window.removeEventListener("keydown", handleKeys);
    }, [setTool, setLastShapeType, isViewerRef]);

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
        const mx = cx - rect.left, my = cy - rect.top;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (elementsRef.current.length === 0) {
            minX = -1000; minY = -1000; maxX = 1000; maxY = 1000;
        } else {
            for (const el of elementsRef.current) {
                const b = getElementBounds(el);
                if (b.x < minX) minX = b.x;
                if (b.x + b.w > maxX) maxX = b.x + b.w;
                if (b.y < minY) minY = b.y;
                if (b.y + b.h > maxY) maxY = b.y + b.h;
            }
        }
        const mainW = window.innerWidth;
        const mainH = window.innerHeight;
        const vtl = screenToWorld(0, 0); 
        const vbr = screenToWorld(mainW, mainH);
        minX = Math.min(minX, vtl.x) - 200; minY = Math.min(minY, vtl.y) - 200;
        maxX = Math.max(maxX, vbr.x) + 200; maxY = Math.max(maxY, vbr.y) + 200;
        const bw = maxX - minX, bh = maxY - minY;
        const scale = Math.min(mCanvas.width / bw, mCanvas.height / bh);
        const offX = (mCanvas.width - bw * scale) / 2 - minX * scale;
        const offY = (mCanvas.height - bh * scale) / 2 - minY * scale;

        const twX = (mx - offX) / scale, twY = (my - offY) / scale;
        setCamera(prev => ({
            ...prev,
            x: mainW / 2 - twX * prev.z,
            y: mainH / 2 - twY * prev.z,
        }));
    }, [elementsRef, screenToWorld, setCamera]);

    const onPointerDown = useCallback((e) => {
        if (e.target.closest('.ui-container')) return;
        if (e.target.closest('[data-ui="color-menu"]')) return;

        if (e.pointerId != null) {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { }
        }
        const sp = getSP(e);
        const wp = screenToWorld(sp.x, sp.y);
        setMousePos(sp);

        if (e.button === 1 || toolRef.current === "hand") {
            setFollowedUserId(null);
            isPanningRef.current = true;
            lastPointRef.current = sp;
            return;
        }

        if (isViewerRef?.current) return;

        const hitEl = [...elementsRef.current].reverse().find(el => pointHitsElement(wp.x, wp.y, el));
        if (toolRef.current !== "select" || !hitEl) {
            setFollowedUserId(null);
        }

        if (["sticky", "rect", "ellipse", "triangle", "arrow"].includes(toolRef.current)) {
            drawingRef.current = true; strokeStartRef.current = wp;
            const defs = DEFAULT_ELEMENT_STYLES[toolRef.current] || {};
            const darkOverrides = isDark ? { stroke: "#ffffff", color: "#ffffff", textColor: "#ffffff" } : {};
            
            // Respect currently selected color and width for a live preview feel
            const toolStyles = {
                stroke: color,
                strokeWidth: width,
            };
            if (toolRef.current === "sticky") delete toolStyles.strokeWidth; // Stickies use fixed strokeWidth usually

            setGhostElement({
                type: toolRef.current,
                x: wp.x, y: wp.y, w: 0, h: 0,
                ...defs,
                ...toolStyles,
                ...darkOverrides,
                text: "",
                rotation: 0
            });
            return;
        }

        if (toolRef.current === "select") {
            const hitEl = [...elementsRef.current].reverse().find(el => pointHitsElement(wp.x, wp.y, el));
            if (hitEl) {
                if (e.shiftKey) {
                    setSelectedIds(prev => prev.includes(hitEl.id) ? prev.filter(id => id !== hitEl.id) : [...prev, hitEl.id]);
                } else {
                    setSelectedIds(prev => (prev.length === 1 && prev[0] === hitEl.id) ? prev : [hitEl.id]);
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
            const el = {
                id: uid(), type: "text",
                x: wp.x, y: wp.y, w: 300, h: 80,
                ...DEFAULT_ELEMENT_STYLES.text,
                ...darkOverrides,
            };
            setElements(prev => [...prev, el]);
            rendererRef?.current?.updateElement(el);
            if (socket?.connected) socket.emit("addElement", { boardId, element: el });
            yElements?.set(el.id, el);
            pushAction({ type: "ADD_ELEMENT", element: el });
            recordEvent("element.created", el.id, { element: el });
            setSelectedIds([el.id]);
            setPendingEditId(el.id);
            setTool("select");
            return;
        }

        if (toolRef.current === "code") {
            const el = {
                id: uid(), type: "code",
                x: wp.x, y: wp.y, w: 450, h: 300,
                ...DEFAULT_ELEMENT_STYLES.code,
            };
            setElements(prev => [...prev, el]);
            rendererRef?.current?.updateElement(el);
            if (socket?.connected) socket.emit("addElement", { boardId, element: el });
            yElements?.set(el.id, el);
            pushAction({ type: "ADD_ELEMENT", element: el });
            recordEvent("element.created", el.id, { element: el });
            setSelectedIds([el.id]);
            setTool("select");
            return;
        }

        if (toolRef.current === "video") {
            const el = {
                id: uid(), type: "video",
                x: wp.x, y: wp.y, w: 480, h: 320,
                ...DEFAULT_ELEMENT_STYLES.video,
            };
            setElements(prev => [...prev, el]);
            rendererRef?.current?.updateElement(el);
            if (socket?.connected) socket.emit("addElement", { boardId, element: el });
            yElements?.set(el.id, el);
            pushAction({ type: "ADD_ELEMENT", element: el });
            recordEvent("element.created", el.id, { element: el });
            setSelectedIds([el.id]);
            setTool("select");
            return;
        }

        if (toolRef.current === "graph") {
            const el = createDefaultGraphElement({ 
                x: wp.x, 
                y: wp.y, 
                id: uid() 
            });
            setElements(prev => [...prev, el]);
            rendererRef?.current?.updateElement(el);
            if (socket?.connected) socket.emit("addElement", { boardId, element: el });
            yElements?.set(el.id, el);
            pushAction({ type: "ADD_ELEMENT", element: el });
            recordEvent("element.created", el.id, { element: el });
            setSelectedIds([el.id]);
            setTool("select");
            return;
        }

        if (toolRef.current === "pen") {
            drawingRef.current = true;
            const pressure = e.pressure || 0.5;
            const path = {
                id: uid(),
                type: "path",
                points: [{ x: wp.x, y: wp.y, pressure }],
                color: color,
                width: width,
            };
            currentPathRef.current = path;
            setCurrentPath(path);
            
            recordEvent("path.started", path.id, { 
                points: path.points, 
                color: path.color, 
                width: path.width 
            });

            // Start hold-to-shape tracking
            holdStartPosRef.current = { x: wp.x, y: wp.y };
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            holdTimerRef.current = setTimeout(() => triggerAutoShapeHold(), 500);

            emitCursorMove(wp.x, wp.y);
            return;
        }

        if (toolRef.current === "eraser") {
            isErasingRef.current = true;
            drawingRef.current = true;
            const ep = [wp];
            eraserPathRef.current = ep;
            setEraserPath([...ep]);
            emitCursorMove(wp.x, wp.y);
            return;
        }
    }, [getSP, screenToWorld, setMousePos, toolRef, setFollowedUserId, isViewerRef, elementsRef, isDark, setGhostElement, setSelectedIds, selectionBoxRef, setSelectionBox, setElements, socket, boardId, pushAction, setPendingEditId, setTool, color, width, emitCursorMove, rendererRef, yElements]);

    const onPointerMove = useCallback((e) => {
        const sp = getSP(e); 
        const wp = screenToWorld(sp.x, sp.y); 
        setMousePos(sp);
        emitCursorMove(wp.x, wp.y);

        // Update local cursor for renderer
        if (rendererRef?.current) {
            rendererRef.current.localCursor = {
                tool: toolRef.current,
                x: sp.x, y: sp.y,
                width: width, color: color
            };
        }

        // Record local cursor if recording
        const now = Date.now();
        if (now - lastCursorRecordRef.current > 60) {
            recordEvent("cursor.moved", me?.userId || me?.id, { 
                x: wp.x, 
                y: wp.y,
                name: me?.name || "You",
                color: "#2563eb"
            });
            lastCursorRecordRef.current = now;
        }

        if (isPanningRef.current) {
            const dx = sp.x - lastPointRef.current.x, dy = sp.y - lastPointRef.current.y;
            setCamera(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
            cameraRef.current = { ...cameraRef.current, x: cameraRef.current.x + dx, y: cameraRef.current.y + dy };
            lastPointRef.current = sp; return;
        }

        if (selectionBoxRef.current) {
            const origin = selectionBoxRef.current;
            const nw = wp.x - origin.x;
            const nh = wp.y - origin.y;
            selectionBoxRef.current = { ...origin, w: nw, h: nh };
            setSelectionBox({ ...selectionBoxRef.current });
            return;
        }

        if (drawingRef.current && ghostElement) {
            const s = strokeStartRef.current;
            if (ghostElement.type === "arrow") {
                const dx = wp.x - s.x;
                const dy = wp.y - s.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                const mx = (s.x + wp.x) / 2;
                const my = (s.y + wp.y) / 2;
                const height = 40;
                setGhostElement(prev => ({
                    ...prev,
                    x: mx - dist / 2,
                    y: my - height / 2,
                    w: dist,
                    h: height,
                    rotation: angle
                }));
                return;
            }

            let rawW = Math.abs(wp.x - s.x);
            let rawH = Math.abs(wp.y - s.y);
            if (e.shiftKey || ghostElement.type === "sticky") {
                const size = Math.max(rawW, rawH);
                rawW = size; rawH = size;
            }
            let ox, oy, nw, nh;
            if (e.altKey) {
                nw = rawW * 2; nh = rawH * 2;
                ox = s.x - rawW; oy = s.y - rawH;
            } else {
                nw = rawW; nh = rawH;
                ox = wp.x < s.x ? s.x - rawW : s.x;
                oy = wp.y < s.y ? s.y - rawH : s.y;
            }
            setGhostElement(prev => ({ ...prev, x: ox, y: oy, w: nw, h: nh }));
            return;
        }

        if (drawingRef.current && currentPathRef.current) {
            const pressure = e.pressure || 0.5;
            const origin = strokeStartRef.current;
            let p = wp;
            if (e.shiftKey && origin) {
                const dx = wp.x - origin.x, dy = wp.y - origin.y;
                const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
                const dist = Math.sqrt(dx * dx + dy * dy);
                p = { x: origin.x + Math.cos(angle) * dist, y: origin.y + Math.sin(angle) * dist };
            }
            currentPathRef.current.points.push({ x: p.x, y: p.y, pressure });
            setCurrentPath({ ...currentPathRef.current });

            recordEvent("path.appended", currentPathRef.current.id, { 
                newPoint: { x: p.x, y: p.y, pressure } 
            });

            // Samsung-style hold detection: 
            // If we moved too far from the point where the timer started, reset it.
            if (holdStartPosRef.current) {
                const dx = wp.x - holdStartPosRef.current.x;
                const dy = wp.y - holdStartPosRef.current.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 12) {
                    // Reset timer to current position
                    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
                    holdStartPosRef.current = { x: wp.x, y: wp.y };
                    
                    // If we were already showing a preview, clear it (user is drawing again)
                    if (autoShapePreviewRef.current) {
                        autoShapePreviewRef.current = null;
                        setAutoShapePreview(null);
                    }
                    
                    holdTimerRef.current = setTimeout(() => triggerAutoShapeHold(), 500);
                }
            }

            const now = Date.now();
            if (now - lastEmittedTimeRef.current > 40) {
                socket?.emit("draw:stroke-progress", { boardId, stroke: currentPathRef.current });
                lastEmittedTimeRef.current = now;
            }
            return;
        }

        if (isErasingRef.current && eraserPathRef.current) {
            const prevPoint = eraserPathRef.current[eraserPathRef.current.length - 1];
            eraserPathRef.current.push(wp);
            setEraserPath([...eraserPathRef.current]);

            setElements(prev => prev.map(el => {
                if (el.isMarkedForErasure) return el;
                if (eraserHitsElement(prevPoint.x, prevPoint.y, wp.x, wp.y, el)) {
                    const marked = { ...el, isMarkedForErasure: true };
                    rendererRef?.current?.updateElement(marked);
                    return marked;
                }
                return el;
            }));
            return;
        }
    }, [getSP, screenToWorld, setMousePos, emitCursorMove, setCamera, cameraRef, selectionBoxRef, setSelectionBox, ghostElement, setGhostElement, socket, boardId, setElements, rendererRef, toolRef, width, color]);

    const onPointerUp = useCallback((e) => {
        if (selectionBoxRef.current) {
            const box = selectionBoxRef.current;
            const x1 = Math.min(box.x, box.x + box.w);
            const y1 = Math.min(box.y, box.y + box.h);
            const x2 = Math.max(box.x, box.x + box.w);
            const y2 = Math.max(box.y, box.y + box.h);

            const hits = elementsRef.current.filter(el => {
                const b = getElementBounds(el);
                return b.x < x2 && b.x + b.w > x1 && b.y < y2 && b.y + b.h > y1;
            }).map(el => el.id);

            if (e.shiftKey) {
                setSelectedIds(prev => [...new Set([...prev, ...hits])]);
            } else {
                setSelectedIds(hits);
            }
            selectionBoxRef.current = null;
            setSelectionBox(null);
            return;
        }

        if (isPanningRef.current) { isPanningRef.current = false; return; }

        if (drawingRef.current && ghostElement) {
            const el = { ...ghostElement, id: uid() };
            if (el.w > 5 || el.h > 5) {
                setElements(prev => [...prev, el]);
                rendererRef?.current?.updateElement(el);
                if (socket?.connected) socket.emit("addElement", { boardId, element: el });
                yElements?.set(el.id, el);
                setSelectedIds([el.id]);
                pushAction({ type: "ADD_ELEMENT", element: el });
                recordEvent("element.created", el.id, { element: el });
            }
            setGhostElement(null); drawingRef.current = false; setTool("select"); return;
        }

        if (drawingRef.current && currentPathRef.current) {
            const path = currentPathRef.current;
            currentPathRef.current = null;
            setCurrentPath(null);
            drawingRef.current = false;

            // Clear hold timer
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;

            recordEvent("path.finished", path.id, {});

            if (socket?.connected) socket.emit("draw:stroke-end", { boardId });

            // If we have a hold-preview, commit that instead of the raw path
            if (autoShapePreviewRef.current) {
                const el = { ...autoShapePreviewRef.current, userId: me?.userId || me?.id };
                setElements(prev => [...prev, el]);
                rendererRef?.current?.updateElement(el);
                if (socket?.connected) socket.emit("addElement", { boardId, element: el });
                yElements?.set(el.id, el);
                pushAction({ type: "ADD_ELEMENT", element: el });
                recordEvent("element.created", el.id, { element: el });

                
                // Clear preview
                setAutoShapePreview(null);
                autoShapePreviewRef.current = null;
                return;
            }

            if (path && path.points.length > 0) {
                const bounds = getPathBounds(path.points);
                const finalId = path.id;
                const el = {
                    ...path,
                    id: finalId,
                    ...bounds,
                    userId: me?.userId || me?.id,
                };
                setElements(prev => [...prev, el]);
                rendererRef?.current?.updateElement(el);
                if (socket?.connected) socket.emit("addElement", { boardId, element: el });
                yElements?.set(el.id, el);
                pushAction({ type: "ADD_ELEMENT", element: el });
                recordEvent("element.created", finalId, { element: el });

            }
            return;
        }

        if (isErasingRef.current) {
            isErasingRef.current = false;
            eraserPathRef.current = null;
            setEraserPath(null);

            const marked = elementsRef.current.filter(el => el.isMarkedForErasure);
            if (marked.length > 0) {
                const cleanMarked = marked.map(el => {
                    const { isMarkedForErasure, ...rest } = el;
                    return rest;
                });
                setElements(prev => prev.filter(el => !el.isMarkedForErasure));
                for (const el of marked) {
                    rendererRef?.current?.deleteElement(el.id);
                    if (socket?.connected) socket.emit("deleteElement", { boardId, elementId: el.id });
                    yElements?.delete(el.id);
                    recordEvent("element.deleted", el.id, {});
                }
                pushAction({ type: "ERASE_ELEMENTS", elements: cleanMarked });
            } else {
                setElements(prev => prev.map(el => {
                    if (el.isMarkedForErasure) {
                        const { isMarkedForErasure, ...rest } = el;
                        rendererRef?.current?.updateElement(rest);
                        return rest;
                    }
                    return el;
                }));
            }
            drawingRef.current = false;
            return;
        }
        drawingRef.current = false;
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
    }, [selectionBoxRef, setSelectionBox, elementsRef, setSelectedIds, ghostElement, setElements, socket, boardId, pushAction, setTool, me, yElements]);

    // ── Auto-shape Hold-to-Shape logic ────────────────────────────────────

    const triggerAutoShapeHold = useCallback(() => {
        if (!currentPathRef.current || currentPathRef.current.points.length < 10) return;
        
        try {
            const detection = classifyStroke(currentPathRef.current.points);
            if (detection && detection.kind) {
                // We use the same conversion logic
                // But we don't commit it to history yet
                const el = {
                    ...currentPathRef.current,
                    ...getPathBounds(currentPathRef.current.points)
                };
                const proposed = convertPathToShape(el, detection);
                if (proposed) {
                    autoShapePreviewRef.current = proposed;
                    setAutoShapePreview(proposed);
                    
                    // Haptic feedback feel: slightly dim the current path or hide it?
                    // We'll let the UI handle showing the preview.
                }
            }
        } catch (e) {
            console.error("AutoShape hold error", e);
        }
    }, [setElements]);

    // ── Auto-shape accept / dismiss callbacks ─────────────────────────────


    return {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        currentPath,
        eraserPath,
        handleMinimapPointer,
        // Samsung hold preview
        autoShapePreview
    };
}

// DUAL-WRITE AUDIT — useCanvasInteraction
// socket.emit addElement calls: 7
// socket.emit updateElement calls: 0
// socket.emit updateElements calls: 0
// socket.emit deleteElement calls: 1
// yElements writes: 8
// counts match: YES
