import { useState, useRef, useEffect, useCallback } from "react";
import { uid } from "../components/canvas/utils/ids";
import { pointHitsElement, getElementBounds, getPathBounds } from "../components/canvas/geometryUtils";
import { eraserHitsElement } from "../components/canvas/utils/eraserMath";
import { DEFAULT_ELEMENT_STYLES } from "../components/canvas/constants";

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
    minimapCanvasRef
}) {
    // In-progress pen stroke (vector preview)
    const [currentPath, setCurrentPath] = useState(null);
    const currentPathRef = useRef(null);

    // Eraser state
    const [eraserPath, setEraserPath] = useState(null);
    const eraserPathRef = useRef(null);
    const isErasingRef = useRef(false);

    // Interaction refs
    const drawingRef = useRef(false);
    const isPanningRef = useRef(false);
    const lastPointRef = useRef({ x: 0, y: 0 });
    const strokeStartRef = useRef(null);
    const lastEmittedTimeRef = useRef(0);

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
            setGhostElement({
                type: toolRef.current,
                x: wp.x, y: wp.y, w: 0, h: 0,
                ...defs,
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
            if (socket?.connected) socket.emit("addElement", { boardId, element: el });
            pushAction({ type: "ADD_ELEMENT", element: el });
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
            if (socket?.connected) socket.emit("addElement", { boardId, element: el });
            pushAction({ type: "ADD_ELEMENT", element: el });
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
            if (socket?.connected) socket.emit("addElement", { boardId, element: el });
            pushAction({ type: "ADD_ELEMENT", element: el });
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
    }, [getSP, screenToWorld, setMousePos, toolRef, setFollowedUserId, isViewerRef, elementsRef, isDark, setGhostElement, setSelectedIds, selectionBoxRef, setSelectionBox, setElements, socket, boardId, pushAction, setPendingEditId, setTool, color, width, emitCursorMove]);

    const onPointerMove = useCallback((e) => {
        const sp = getSP(e); 
        const wp = screenToWorld(sp.x, sp.y); 
        setMousePos(sp);
        emitCursorMove(wp.x, wp.y);

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
                    return { ...el, isMarkedForErasure: true };
                }
                return el;
            }));
            return;
        }
    }, [getSP, screenToWorld, setMousePos, emitCursorMove, setCamera, cameraRef, selectionBoxRef, setSelectionBox, ghostElement, setGhostElement, socket, boardId, setElements]);

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
                if (socket?.connected) socket.emit("addElement", { boardId, element: el });
                setSelectedIds([el.id]);
                pushAction({ type: "ADD_ELEMENT", element: el });
            }
            setGhostElement(null); drawingRef.current = false; setTool("select"); return;
        }

        if (drawingRef.current && currentPathRef.current) {
            const path = currentPathRef.current;
            currentPathRef.current = null;
            setCurrentPath(null);
            drawingRef.current = false;
            if (socket?.connected) socket.emit("draw:stroke-end", { boardId });

            if (path && path.points.length > 0) {
                const bounds = getPathBounds(path.points);
                const el = {
                    ...path,
                    id: uid(),
                    ...bounds,
                    userId: me?.userId || me?.id,
                };
                setElements(prev => [...prev, el]);
                if (socket?.connected) socket.emit("addElement", { boardId, element: el });
                pushAction({ type: "ADD_ELEMENT", element: el });
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
                    if (socket?.connected) socket.emit("deleteElement", { boardId, elementId: el.id });
                }
                pushAction({ type: "ERASE_ELEMENTS", elements: cleanMarked });
            } else {
                setElements(prev => prev.map(el => {
                    if (el.isMarkedForErasure) {
                        const { isMarkedForErasure, ...rest } = el;
                        return rest;
                    }
                    return el;
                }));
            }
            drawingRef.current = false;
            return;
        }
        drawingRef.current = false;
    }, [selectionBoxRef, setSelectionBox, elementsRef, setSelectedIds, ghostElement, setElements, socket, boardId, pushAction, setTool, me]);

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        currentPath,
        eraserPath,
        handleMinimapPointer
    };
}
