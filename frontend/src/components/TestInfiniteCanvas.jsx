import { useEffect, useRef, useState, useCallback } from "react";
import { Pen, Eraser, Hand, ZoomIn, ZoomOut, Settings2, Trash2, Map as MapIcon, StickyNote, Square, Circle, Triangle, ArrowRight, MousePointer2, ChevronUp, Type, Terminal, Youtube, Plus } from "lucide-react";
import ElementsLayer from "./ElementsLayer";
import { DEFAULT_ELEMENT_STYLES } from "./canvas/constants";
import { getSvgPathFromStroke, getPathBounds, getElementBounds, pointHitsElement } from "./canvas/geometryUtils";
import getStroke from "perfect-freehand";

// Tiny unique id generator (no dependency needed)
function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}


// ── Line-segment vs AABB intersection (for eraser on shapes) ────────────────
function lineIntersectsAABB(x1, y1, x2, y2, rx, ry, rw, rh) {
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
    const code = (x, y) => {
        let c = INSIDE;
        if (x < rx) c |= LEFT; else if (x > rx + rw) c |= RIGHT;
        if (y < ry) c |= TOP; else if (y > ry + rh) c |= BOTTOM;
        return c;
    };
    let c1 = code(x1, y1), c2 = code(x2, y2);
    while (true) {
        if (!(c1 | c2)) return true;
        if (c1 & c2) return false;
        const cout = c1 || c2;
        let x, y;
        if (cout & BOTTOM) { x = x1 + (x2 - x1) * (ry + rh - y1) / (y2 - y1); y = ry + rh; }
        else if (cout & TOP) { x = x1 + (x2 - x1) * (ry - y1) / (y2 - y1); y = ry; }
        else if (cout & RIGHT) { y = y1 + (y2 - y1) * (rx + rw - x1) / (x2 - x1); x = rx + rw; }
        else { y = y1 + (y2 - y1) * (rx - x1) / (x2 - x1); x = rx; }
        if (cout === c1) { x1 = x; y1 = y; c1 = code(x1, y1); }
        else { x2 = x; y2 = y; c2 = code(x2, y2); }
    }
}

// ── Minimum distance from point to a line segment ───────────────────────────
function pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ── Minimum distance between two line segments ──────────────────────────────
function segmentToSegmentDist(ax, ay, bx, by, cx, cy, dx2, dy2) {
    // Check if segments actually intersect (distance = 0)
    const d1x = bx - ax, d1y = by - ay;
    const d2x = dx2 - cx, d2y = dy2 - cy;
    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) > 1e-10) {
        const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
        const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
    }
    // Otherwise compute min distance of endpoints to opposite segment
    return Math.min(
        pointToSegmentDist(ax, ay, cx, cy, dx2, dy2),
        pointToSegmentDist(bx, by, cx, cy, dx2, dy2),
        pointToSegmentDist(cx, cy, ax, ay, bx, by),
        pointToSegmentDist(dx2, dy2, ax, ay, bx, by)
    );
}

// ── Check if eraser segment hits an element ─────────────────────────────────
function eraserHitsElement(ex1, ey1, ex2, ey2, el) {
    if (el.type === "path" && el.points && el.points.length >= 2) {
        // For path elements, test against each actual polyline segment
        const tolerance = Math.max(8, (el.width || 2) * 1.5);
        for (let i = 0; i < el.points.length - 1; i++) {
            const a = el.points[i], b = el.points[i + 1];
            const dist = segmentToSegmentDist(ex1, ey1, ex2, ey2, a.x, a.y, b.x, b.y);
            if (dist <= tolerance) return true;
        }
        return false;
    }

    const { x, y, w, h } = el;
    const sW = el.strokeWidth || 2;
    const tol = Math.max(8, sW * 1.5);

    // Account for rotation by transforming the eraser segment into the element's local space
    let lex1 = ex1, ley1 = ey1, lex2 = ex2, ley2 = ey2;
    if (el.rotation) {
        const rad = (-el.rotation * Math.PI) / 180; // Negative rotation for local space
        const cx = x + w / 2;
        const cy = y + h / 2;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const tx1 = ex1 - cx, ty1 = ey1 - cy;
        lex1 = cx + (tx1 * cos - ty1 * sin);
        ley1 = cy + (tx1 * sin + ty1 * cos);

        const tx2 = ex2 - cx, ty2 = ey2 - cy;
        lex2 = cx + (tx2 * cos - ty2 * sin);
        ley2 = cy + (tx2 * sin + ty2 * cos);
    }

    // For transparent/unfilled shapes, check intersection against the precise perimeter geometry in local space
    const isUnfilled = el.fill === "transparent" || el.fill === "none";
    if (isUnfilled) {
        if (el.type === "rect") {
            return (
                segmentToSegmentDist(lex1, ley1, lex2, ley2, x, y, x + w, y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, x, y + h, x + w, y + h) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, x, y, x, y + h) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, x + w, y, x + w, y + h) <= tol
            );
        }

        if (el.type === "triangle") {
            const v1 = { x: x + w / 2, y: y + sW };
            const v2 = { x: x + w - sW, y: y + h - sW };
            const v3 = { x: x + sW, y: y + h - sW };
            return (
                segmentToSegmentDist(lex1, ley1, lex2, ley2, v1.x, v1.y, v2.x, v2.y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, v2.x, v2.y, v3.x, v3.y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, v3.x, v3.y, v1.x, v1.y) <= tol
            );
        }

        if (el.type === "arrow") {
            const arrowHeadSize = 12;
            const shaftStart = { x: x + sW, y: y + h / 2 };
            const shaftEnd = { x: x + w - arrowHeadSize, y: y + h / 2 };
            const headTip = { x: x + w - sW, y: y + h / 2 };
            const headUpper = { x: x + w - arrowHeadSize, y: y + h / 2 - arrowHeadSize / 2 };
            const headLower = { x: x + w - arrowHeadSize, y: y + h / 2 + arrowHeadSize / 2 };
            return (
                segmentToSegmentDist(lex1, ley1, lex2, ley2, shaftStart.x, shaftStart.y, shaftEnd.x, shaftEnd.y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, headTip.x, headTip.y, headUpper.x, headUpper.y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, headTip.x, headTip.y, headLower.x, headLower.y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, headUpper.x, headUpper.y, headLower.x, headLower.y) <= tol
            );
        }

        if (el.type === "ellipse") {
            const cx = x + w / 2, cy = y + h / 2;
            const rx = Math.max(0, w / 2 - sW / 2);
            const ry = Math.max(0, h / 2 - sW / 2);
            const segments = 32;
            for (let i = 0; i < segments; i++) {
                const a1 = (i / segments) * Math.PI * 2;
                const a2 = ((i + 1) / segments) * Math.PI * 2;
                const dist = segmentToSegmentDist(lex1, ley1, lex2, ley2,
                    cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry,
                    cx + Math.cos(a2) * rx, cy + Math.sin(a2) * ry
                );
                if (dist <= tol) return true;
            }
            return false;
        }
    }

    // For solid shapes (or sticky notes), use full footprint/AABB intersection in local space
    return lineIntersectsAABB(lex1, ley1, lex2, ley2, x, y, w, h);
}


// ── Live preview SVG component for the pen stroke being drawn ──────────────
function LivePathPreview({ currentPath, camera }) {
    if (!currentPath || !currentPath.points || currentPath.points.length === 0) return null;

    const outlinePoints = getStroke(currentPath.points.map(p => [p.x, p.y, p.pressure || 0.5]), {
        size: currentPath.width * 2,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
    });

    const pathData = getSvgPathFromStroke(outlinePoints);
    if (!pathData) return null;

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 16, overflow: "visible" }}
        >
            <g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.z})`}>
                <path d={pathData} fill={currentPath.color} stroke="none" opacity={0.85} />
            </g>
        </svg>
    );
}

// ── Eraser trail SVG ───────────────────────────────────────────────────────
function EraserTrailPreview({ eraserPath, camera }) {
    if (!eraserPath || eraserPath.length < 2) return null;
    const d = eraserPath.map((p, i) => {
        const sx = p.x * camera.z + camera.x;
        const sy = p.y * camera.z + camera.y;
        return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
    }).join(" ");

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 16, overflow: "visible" }}
        >
            <path d={d} fill="none" stroke="rgba(239,68,68,0.4)" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />
        </svg>
    );
}

export default function TestInfiniteCanvas({ boardId, socket, initialSegments, me, renderTopLeftUI, talkingUserIds = [] }) {
    // minimap
    const minimapCanvasRef = useRef(null);
    const minimapCtxRef = useRef(null);
    const [isMinimapVisible, setIsMinimapVisible] = useState(true);

    // tool state
    const [tool, setTool] = useState("pen");
    const [color, setColor] = useState("#000000");
    const [width, setWidth] = useState(2);
    const [bgMode, setBgMode] = useState("white");
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        if (isDark) {
            setColor("#ffffff");
        } else {
            setColor("#000000");
        }
    }, [isDark]);

    const toolbarClass = isDark ? "bg-[#1f1f1f] border-[#333333] text-white/70" : "bg-base-100/95 border-base-200";
    const ghostBtnClass = isDark ? "btn-ghost text-white/70 hover:text-white hover:bg-white/10" : "btn-ghost";

    const statusMsgRef = useRef(""); // local ref if needed, but we use state below
    const [statusMsg, setStatusMsg] = useState("");
    const [remoteLiveStrokes, setRemoteLiveStrokes] = useState({}); // userId -> stroke object
    const lastEmittedTimeRef = useRef(0);

    // camera (infinite canvas)
    const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });
    const cameraRef = useRef({ x: 0, y: 0, z: 1 });

    // undo/redo
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);

    // in-progress pen stroke (vector preview)
    const [currentPath, setCurrentPath] = useState(null);
    const currentPathRef = useRef(null);

    // eraser state
    const [eraserPath, setEraserPath] = useState(null);
    const eraserPathRef = useRef(null);
    const isErasingRef = useRef(false);

    // interaction state
    const drawingRef = useRef(false);
    const isPanningRef = useRef(false);
    const lastPointRef = useRef({ x: 0, y: 0 });
    const strokeStartRef = useRef(null);
    const [ctrlPressed, setCtrlPressed] = useState(false);

    // custom eraser cursor
    const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
    const toolRef = useRef(tool);
    useEffect(() => { toolRef.current = tool; }, [tool]);

    const [cursors, setCursors] = useState({});
    const [participants, setParticipants] = useState([]);
    const lastCursorEmitRef = useRef(0);
    const socketRef = useRef(socket);
    useEffect(() => { socketRef.current = socket; }, [socket]);

    // elements (sticky notes, shapes, and now path strokes)
    const [elements, setElementsState] = useState([]);
    const elementsRef = useRef(elements);
    // Standard setter that also updates ref immediately
    const setElements = useCallback((updater) => {
        setElementsState(current => {
            const next = typeof updater === "function" ? updater(current) : updater;
            elementsRef.current = next;
            return next;
        });
    }, []);

    const [selectedIds, setSelectedIdsState] = useState([]);
    const selectedIdsRef = useRef(selectedIds);
    // Standard setter that also updates ref immediately
    const setSelectedIds = useCallback((updater) => {
        setSelectedIdsState(current => {
            const next = typeof updater === "function" ? updater(current) : updater;
            selectedIdsRef.current = next;
            return next;
        });
    }, []);

    useEffect(() => {
        if (tool !== "select") setSelectedIds([]);
    }, [tool]);

    const [selectionBox, setSelectionBox] = useState(null);
    const selectionBoxRef = useRef(null);

    const toolbarRef = useRef(null);
    const [toolbarHeight, setToolbarHeight] = useState(80);

    useEffect(() => {
        if (!toolbarRef.current) return;
        const obs = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setToolbarHeight(entry.target.offsetHeight);
            }
        });
        obs.observe(toolbarRef.current);
        return () => obs.disconnect();
    }, []);

    const [ghostElement, setGhostElement] = useState(null);
    const [shapeType, setShapeType] = useState("rect");
    const [lastShapeType, setLastShapeType] = useState("rect");
    const [pendingEditId, setPendingEditId] = useState(null);
    const clearPendingEditId = useCallback(() => setPendingEditId(null), []);

    // ─── coordinate helpers ───────────────────────────────────────────────────

    const screenToWorld = (sx, sy) => ({
        x: (sx - cameraRef.current.x) / cameraRef.current.z,
        y: (sy - cameraRef.current.y) / cameraRef.current.z,
    });

    const worldToScreen = (wx, wy) => ({
        x: wx * cameraRef.current.z + cameraRef.current.x,
        y: wy * cameraRef.current.z + cameraRef.current.y,
    });

    // ─── minimap ─────────────────────────────────────────────────────────────

    const drawMinimap = useCallback(() => {
        if (!isMinimapVisible) return;
        const mCanvas = minimapCanvasRef.current;
        let mCtx = minimapCtxRef.current;
        if (!mCanvas) return;

        if (!mCtx || mCanvas.width !== mCanvas.clientWidth || mCanvas.height !== mCanvas.clientHeight) {
            mCanvas.width = mCanvas.clientWidth;
            mCanvas.height = mCanvas.clientHeight;
            mCtx = mCanvas.getContext("2d");
            minimapCtxRef.current = mCtx;
        }

        mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);

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

        const vTL = screenToWorld(0, 0);
        const vBR = screenToWorld(mCanvas.width * 10, mCanvas.height * 10);
        minX = Math.min(minX, vTL.x); minY = Math.min(minY, vTL.y);
        maxX = Math.max(maxX, vBR.x); maxY = Math.max(maxY, vBR.y);

        const pad = 200;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        const bw = maxX - minX, bh = maxY - minY;
        const scale = Math.min(mCanvas.width / bw, mCanvas.height / bh);
        const offX = (mCanvas.width - bw * scale) / 2 - minX * scale;
        const offY = (mCanvas.height - bh * scale) / 2 - minY * scale;

        mCtx.save();
        mCtx.lineCap = "round"; mCtx.lineJoin = "round";

        for (const el of elementsRef.current) {
            mCtx.save();
            const b = getElementBounds(el);
            const ex = b.x * scale + offX;
            const ey = b.y * scale + offY;
            const ew = Math.max(1, b.w * scale);
            const eh = Math.max(1, b.h * scale);

            mCtx.translate(ex + ew / 2, ey + eh / 2);
            mCtx.rotate((el.rotation || 0) * Math.PI / 180);
            mCtx.translate(-(ex + ew / 2), -(ey + eh / 2));

            mCtx.lineWidth = Math.max(1, (el.strokeWidth || 2) * scale);

            if (el.type === "path") {
                mCtx.strokeStyle = el.color || "#000";
                mCtx.lineWidth = Math.max(1, (el.width || 2) * scale);
                if (el.points && el.points.length > 0) {
                    mCtx.beginPath();
                    mCtx.moveTo(el.points[0].x * scale + offX, el.points[0].y * scale + offY);
                    for (let i = 1; i < el.points.length; i++) {
                        mCtx.lineTo(el.points[i].x * scale + offX, el.points[i].y * scale + offY);
                    }
                    mCtx.stroke();
                }
            } else if (el.type === "sticky") {
                mCtx.fillStyle = el.fill || "#fef08a";
                mCtx.strokeStyle = el.stroke || "#e2c94e";
                mCtx.fillRect(ex, ey, ew, eh);
                mCtx.strokeRect(ex, ey, ew, eh);
            } else if (el.type === "rect") {
                mCtx.fillStyle = el.fill === "none" ? "transparent" : (el.fill || "transparent");
                mCtx.strokeStyle = el.stroke || "#000";
                if (el.fill !== "none") mCtx.fillRect(ex, ey, ew, eh);
                mCtx.strokeRect(ex, ey, ew, eh);
            } else if (el.type === "ellipse") {
                mCtx.fillStyle = el.fill === "none" ? "transparent" : (el.fill || "transparent");
                mCtx.strokeStyle = el.stroke || "#000";
                mCtx.beginPath();
                mCtx.ellipse(ex + ew / 2, ey + eh / 2, Math.max(0, ew / 2 - mCtx.lineWidth / 2), Math.max(0, eh / 2 - mCtx.lineWidth / 2), 0, 0, 2 * Math.PI);
                if (el.fill !== "none") mCtx.fill();
                mCtx.stroke();
            } else if (el.type === "triangle") {
                mCtx.fillStyle = el.fill === "none" ? "transparent" : (el.fill || "transparent");
                mCtx.strokeStyle = el.stroke || "#000";
                mCtx.beginPath();
                mCtx.moveTo(ex + ew / 2, ey + mCtx.lineWidth);
                mCtx.lineTo(ex + ew - mCtx.lineWidth, ey + eh - mCtx.lineWidth);
                mCtx.lineTo(ex + mCtx.lineWidth, ey + eh - mCtx.lineWidth);
                mCtx.closePath();
                if (el.fill !== "none") mCtx.fill();
                mCtx.stroke();
            } else if (el.type === "arrow") {
                mCtx.strokeStyle = el.stroke || "#000";
                mCtx.beginPath();
                mCtx.moveTo(ex + mCtx.lineWidth, ey + eh / 2);
                mCtx.lineTo(ex + ew - 4, ey + eh / 2);
                mCtx.stroke();
                mCtx.beginPath();
                mCtx.moveTo(ex + ew, ey + eh / 2);
                mCtx.lineTo(ex + ew - 6, ey + eh / 2 - 3);
                mCtx.lineTo(ex + ew - 6, ey + eh / 2 + 3);
                mCtx.fillStyle = mCtx.strokeStyle;
                mCtx.fill();
            } else if (el.type === "code") {
                mCtx.fillStyle = "#374151"; // dark gray for code
                mCtx.fillRect(ex, ey, ew, eh);
            } else if (el.type === "video") {
                mCtx.fillStyle = "#1f2937"; // darker gray/black for video
                mCtx.fillRect(ex, ey, ew, eh);
                // Draw a small red play button indicator in the center
                mCtx.fillStyle = "#ef4444";
                mCtx.beginPath();
                mCtx.moveTo(ex + ew / 2 - 2, ey + eh / 2 - 3);
                mCtx.lineTo(ex + ew / 2 + 4, ey + eh / 2);
                mCtx.lineTo(ex + ew / 2 - 2, ey + eh / 2 + 3);
                mCtx.fill();
            }
            mCtx.restore();
        }

        // viewport indicator
        const mainW = window.innerWidth;
        const mainH = window.innerHeight;
        const vtl = screenToWorld(0, 0); const vbr = screenToWorld(mainW, mainH);
        mCtx.fillStyle = "rgba(59, 130, 246, 0.2)"; mCtx.strokeStyle = "rgba(59, 130, 246, 0.8)";
        mCtx.lineWidth = 1;
        const vx = vtl.x * scale + offX, vy = vtl.y * scale + offY;
        const vw = (vbr.x - vtl.x) * scale, vh = (vbr.y - vtl.y) * scale;
        mCtx.fillRect(vx, vy, vw, vh); mCtx.strokeRect(vx, vy, vw, vh);

        mCtx.restore();
    }, [isMinimapVisible]);

    useEffect(() => {
        drawMinimap();
    }, [elements, isMinimapVisible, camera, drawMinimap]);

    const handleMinimapPointer = (e) => {
        if (!isMinimapVisible) return;
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
        const vtl = screenToWorld(0, 0); const vbr = screenToWorld(mainW, mainH);
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
    };

    // ─── camera sync ─────────────────────────────────────────────────────────

    useEffect(() => {
        cameraRef.current = camera;
    }, [camera]);

    // ─── minimap toggle fix ───────────────────────────────────────

    useEffect(() => {
        if (isMinimapVisible) {
            minimapCtxRef.current = null;
            setTimeout(() => drawMinimap(), 0);
        }
    }, [isMinimapVisible, drawMinimap]);

    // ─── socket events ────────────────────────────────────────────────────────

    useEffect(() => {
        window.addEventListener("resize", drawMinimap);

        if (socket) {
            socket.on("boardElements", (els) => setElements(els || []));
            socket.on("elementAdded", (el) => setElements(prev => [...prev, el]));
            socket.on("elementUpdated", (el) => setElements(prev => prev.map(e => e.id === el.id ? el : e)));
            socket.on("elementsUpdated", (newElements) => {
                if (!Array.isArray(newElements)) return;
                setElements(prev => {
                    const map = new Map(prev.map(e => [e.id, e]));
                    newElements.forEach(el => {
                        if (el && el.id) map.set(el.id, el);
                    });
                    return Array.from(map.values());
                });
            });
            socket.on("elementDeleted", ({ elementId }) => setElements(prev => prev.filter(e => e.id !== elementId)));

            socket.on("cleared", () => {
                undoStackRef.current = [];
                redoStackRef.current = [];
                setElements([]);
                setStatusMsg("Cleared ✅");
                setTimeout(() => setStatusMsg(""), 1500);
            });

            socket.on("saved", () => { setStatusMsg("Saved ✅"); setTimeout(() => setStatusMsg(""), 1500); });

            socket.on("boardParticipants", (p) => setParticipants(p || []));
            socket.on("cursorJoin", ({ userId, name, color }) => {
                setCursors(prev => ({ ...prev, [userId]: { name, color, x: 0, y: 0, ts: Date.now() } }));
                setParticipants(prev => {
                    if (prev.find(p => p.userId === userId)) return prev;
                    return [...prev, { userId, name, color }];
                });
            });
            socket.on("cursorMove", ({ userId, name, color, x, y }) => {
                setCursors(prev => ({ ...prev, [userId]: { name, color, x, y, ts: Date.now() } }));
                setParticipants(prev => {
                    if (prev.find(p => p.userId === userId)) return prev;
                    return [...prev, { userId, name, color }];
                });
            });
            socket.on("cursorLeave", ({ userId }) => {
                setParticipants(prev => prev.filter(p => (p.userId || p.peerId) !== userId));
                setCursors(prev => {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
                setRemoteLiveStrokes(prev => {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
            });

            socket.on("draw:stroke-progress", ({ userId, stroke }) => {
                setRemoteLiveStrokes(prev => ({
                    ...prev,
                    [userId]: stroke
                }));
            });

            socket.on("draw:stroke-end", ({ userId }) => {
                setRemoteLiveStrokes(prev => {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
            });
        }

        return () => {
            window.removeEventListener("resize", drawMinimap);
            if (socket) {
                socket.off("cleared"); socket.off("saved");
                socket.off("cursorJoin"); socket.off("cursorMove"); socket.off("cursorLeave");
                socket.off("elementAdded"); socket.off("elementUpdated"); socket.off("elementDeleted");
                socket.off("boardElements");
                socket.off("draw:stroke-progress");
                socket.off("draw:stroke-end");
            }
        };
    }, [socket, drawMinimap]);

    useEffect(() => {
        const t = setInterval(() => {
            const now = Date.now();
            setCursors(prev => {
                const copy = { ...prev }; let changed = false;
                for (const [uid, c] of Object.entries(copy)) { if (now - c.ts > 8000) { delete copy[uid]; changed = true; } }
                return changed ? copy : prev;
            });
        }, 2000);
        return () => clearInterval(t);
    }, []);

    // ─── wheel zoom / pan ────────────────────────────────────────────────────

    useEffect(() => {
        const handleWheel = (e) => {
            // ALWAYS prevent default browser zoom if Ctrl/Meta is held, 
            // regardless of where the mouse is.
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                setCamera(prev => {
                    let nZ = prev.z * Math.exp(-e.deltaY * 0.005);
                    nZ = Math.min(10, Math.max(0.1, nZ));
                    const sx = e.clientX, sy = e.clientY;
                    return { x: sx - (sx - prev.x) * (nZ / prev.z), y: sy - (sy - prev.y) * (nZ / prev.z), z: nZ };
                });
                return;
            }

            // Regular scroll panning (also prevented default to avoid browser back/forward or page scroll)
            e.preventDefault();
            setCamera(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY, z: prev.z }));
        };

        // Use capture: true to intercept before children stop propagation
        // and passive: false to allow preventDefault()
        window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
        return () => window.removeEventListener("wheel", handleWheel, { capture: true });
    }, []);

    // Global Ctrl key tracking to help with iframe pointer-events
    useEffect(() => {
        const handleDown = (e) => { if (e.key === "Control" || e.key === "Meta") setCtrlPressed(true); };
        const handleUp = (e) => { if (e.key === "Control" || e.key === "Meta") setCtrlPressed(false); };
        const handleBlur = () => setCtrlPressed(false);
        window.addEventListener("keydown", handleDown);
        window.addEventListener("keyup", handleUp);
        window.addEventListener("blur", handleBlur);
        return () => {
            window.removeEventListener("keydown", handleDown);
            window.removeEventListener("keyup", handleUp);
            window.removeEventListener("blur", handleBlur);
        };
    }, []);

    useEffect(() => {
        if (ctrlPressed) document.body.classList.add("ctrl-down");
        else document.body.classList.remove("ctrl-down");
    }, [ctrlPressed]);

    // ─── middle-click panning (window level, works even over elements) ─────
    useEffect(() => {
        const onMidDown = (e) => {
            if (e.button !== 1) return;
            e.preventDefault();
            isPanningRef.current = true;
            lastPointRef.current = { x: e.clientX, y: e.clientY };
        };
        const onMidMove = (e) => {
            if (!isPanningRef.current) return;
            const dx = e.clientX - lastPointRef.current.x;
            const dy = e.clientY - lastPointRef.current.y;
            setCamera(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
            cameraRef.current = { ...cameraRef.current, x: cameraRef.current.x + dx, y: cameraRef.current.y + dy };
            lastPointRef.current = { x: e.clientX, y: e.clientY };
        };
        const onMidUp = (e) => {
            if (e.button !== 1) return;
            isPanningRef.current = false;
        };
        window.addEventListener("pointerdown", onMidDown);
        window.addEventListener("pointermove", onMidMove);
        window.addEventListener("pointerup", onMidUp);
        return () => {
            window.removeEventListener("pointerdown", onMidDown);
            window.removeEventListener("pointermove", onMidMove);
            window.removeEventListener("pointerup", onMidUp);
        };
    }, []);

    // ─── keyboard undo / redo ────────────────────────────────────────────────

    const pushAction = useCallback((action) => {
        undoStackRef.current.push(action);
        redoStackRef.current = [];
    }, []);

    const performUndo = useCallback(() => {
        const action = undoStackRef.current.pop();
        if (!action) return;

        redoStackRef.current.push(action);

        switch (action.type) {
            case "ADD_ELEMENT":
                setElements(prev => prev.filter(e => e.id !== action.element.id));
                if (socket?.connected) socket.emit("deleteElement", { boardId, elementId: action.element.id });
                break;
            case "UPDATE_ELEMENT":
                setElements(prev => prev.map(e => (e.id === action.id ? action.oldState : e)));
                if (socket?.connected) socket.emit("updateElement", { boardId, element: action.oldState });
                break;
            case "UPDATE_ELEMENTS":
                setElements(prev => {
                    const map = new Map(prev.map(e => [e.id, e]));
                    action.before.forEach(el => map.set(el.id, el));
                    return Array.from(map.values());
                });
                if (socket?.connected) socket.emit("updateElements", { boardId, elements: action.before });
                break;
            case "DELETE_ELEMENT":
                setElements(prev => [...prev, action.element]);
                if (socket?.connected) socket.emit("addElement", { boardId, element: action.element });
                break;
            case "ERASE_ELEMENTS":
                // Re-add all erased elements
                setElements(prev => [...prev, ...action.elements]);
                for (const el of action.elements) {
                    if (socket?.connected) socket.emit("addElement", { boardId, element: el });
                }
                break;
            default:
                break;
        }
    }, [socket, boardId]);

    const performRedo = useCallback(() => {
        const action = redoStackRef.current.pop();
        if (!action) return;

        undoStackRef.current.push(action);

        switch (action.type) {
            case "ADD_ELEMENT":
                setElements(prev => [...prev, action.element]);
                if (socket?.connected) socket.emit("addElement", { boardId, element: action.element });
                break;
            case "UPDATE_ELEMENT":
                setElements(prev => prev.map(e => (e.id === action.id ? action.newState : e)));
                if (socket?.connected) socket.emit("updateElement", { boardId, element: action.newState });
                break;
            case "UPDATE_ELEMENTS":
                setElements(prev => {
                    const map = new Map(prev.map(e => [e.id, e]));
                    action.after.forEach(el => map.set(el.id, el));
                    return Array.from(map.values());
                });
                if (socket?.connected) socket.emit("updateElements", { boardId, elements: action.after });
                break;
            case "DELETE_ELEMENT":
                setElements(prev => prev.filter(e => e.id !== action.element.id));
                if (socket?.connected) socket.emit("deleteElement", { boardId, elementId: action.element.id });
                break;
            case "ERASE_ELEMENTS":
                // Re-delete all erased elements
                setElements(prev => prev.filter(e => !action.elements.find(ae => ae.id === e.id)));
                for (const el of action.elements) {
                    if (socket?.connected) socket.emit("deleteElement", { boardId, elementId: el.id });
                }
                break;
            default:
                break;
        }
    }, [socket, boardId]);

    useEffect(() => {
        const hkd = (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (["+", "=", "-", "_", "0"].includes(e.key)) { e.preventDefault(); return; }
                if (e.key.toLowerCase() === "z") {
                    e.preventDefault();
                    if (e.shiftKey) performRedo(); else performUndo();
                } else if (e.key.toLowerCase() === "y") {
                    e.preventDefault(); performRedo();
                }
            }
        };
        window.addEventListener("keydown", hkd);
        return () => window.removeEventListener("keydown", hkd);
    }, [performUndo, performRedo]);

    // ─── tool shortcuts ───────────────────────────────────────────────────────
    useEffect(() => {
        const handleKeys = (e) => {
            // Ignore if the user is typing in an input, textarea, or contenteditable
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;

            // Ignore if Ctrl/Cmd/Alt is pressed
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
    }, []);

    // ─── pointer events ───────────────────────────────────────────────────────

    const getSP = (e) => {
        const target = e.currentTarget || e.target;
        const rect = target.getBoundingClientRect?.() || { left: 0, top: 0 };
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: cx - rect.left, y: cy - rect.top };
    };

    const emitCursorMove = (wx, wy) => {
        if (!socket?.connected) return;
        const now = Date.now(); if (now - lastCursorEmitRef.current < 30) return;
        lastCursorEmitRef.current = now;
        socket.emit("cursorMove", { boardId, x: wx, y: wy });
    };

    const onPointerDown = (e) => {
        // Ignore clicks on UI elements natively without breaking React's onClick
        if (e.target.closest('.ui-container')) return;

        // Capture pointer so all subsequent move/up events go to this surface,
        // even when the pointer crosses over toolbar, minimap, or other UI
        if (e.pointerId != null) {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { }
        }
        const sp = getSP(e);
        const wp = screenToWorld(sp.x, sp.y);
        setMousePos(sp);
        if (e.button === 1 || toolRef.current === "hand") { isPanningRef.current = true; lastPointRef.current = sp; return; }

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
            // Check if we hit any element precisely (top-down)
            const elementsCopy = [...elementsRef.current].reverse();
            const hitEl = elementsCopy.find(el => pointHitsElement(wp.x, wp.y, el));

            if (hitEl) {
                if (e.shiftKey) {
                    setSelectedIds(prev => prev.includes(hitEl.id) ? prev.filter(id => id !== hitEl.id) : [...prev, hitEl.id]);
                } else {
                    // Isolation click: clear others and select this one (unless it's already the only one)
                    setSelectedIds(prev => (prev.length === 1 && prev[0] === hitEl.id) ? prev : [hitEl.id]);
                }
                return;
            }

            if (!e.shiftKey) setSelectedIds([]);
            selectionBoxRef.current = { x: wp.x, y: wp.y, w: 0, h: 0 };
            setSelectionBox({ ...selectionBoxRef.current });
            return;
        }

        // ── text tool: click to place a text element and start editing immediately ──
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

        // ── code tool: click to place an executable code block ──
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

        // ── video tool: click to place a YouTube embed block ──
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

        // ── Pen tool: start a new vector path ──
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

        // ── Eraser tool: start intersection detection ──
        if (toolRef.current === "eraser") {
            isErasingRef.current = true;
            drawingRef.current = true;
            const ep = [wp];
            eraserPathRef.current = ep;
            setEraserPath([...ep]);
            emitCursorMove(wp.x, wp.y);
            return;
        }
    };

    const onPointerMove = (e) => {
        const sp = getSP(e); const wp = screenToWorld(sp.x, sp.y); setMousePos(sp);
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

                // Position at midpoint to align with center center transform-origin
                const mx = (s.x + wp.x) / 2;
                const my = (s.y + wp.y) / 2;
                const height = 40; // Fixed box height for the arrowSVG line to be at h/2

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

            // Shift = constrain to square (stickies always square)
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

        // ── Pen tool: append point to live preview ──
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

            // Throttle socket emission for performance
            const now = Date.now();
            if (now - lastEmittedTimeRef.current > 40) {
                socket?.emit("draw:stroke-progress", {
                    boardId,
                    stroke: currentPathRef.current
                });
                lastEmittedTimeRef.current = now;
            }
            return;
        }

        // ── Eraser tool: track movement and mark intersecting elements ──
        if (isErasingRef.current && eraserPathRef.current) {
            const prevPoint = eraserPathRef.current[eraserPathRef.current.length - 1];
            eraserPathRef.current.push(wp);
            setEraserPath([...eraserPathRef.current]);

            // Check intersection — paths use polyline proximity, shapes use AABB
            setElements(prev => prev.map(el => {
                if (el.isMarkedForErasure) return el;
                if (eraserHitsElement(prevPoint.x, prevPoint.y, wp.x, wp.y, el)) {
                    return { ...el, isMarkedForErasure: true };
                }
                return el;
            }));
            return;
        }
    };

    const onPointerUp = (e) => {
        if (selectionBoxRef.current) {
            const box = selectionBoxRef.current;
            const x1 = Math.min(box.x, box.x + box.w);
            const y1 = Math.min(box.y, box.y + box.h);
            const x2 = Math.max(box.x, box.x + box.w);
            const y2 = Math.max(box.y, box.y + box.h);

            const hits = elementsRef.current.filter(el => {
                const b = getElementBounds(el);
                // Simple box-box intersection
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

        // ── Pen tool: commit the vector path as an element ──
        if (drawingRef.current && currentPathRef.current) {
            const path = currentPathRef.current;
            currentPathRef.current = null;
            setCurrentPath(null);
            drawingRef.current = false;

            if (socket?.connected) {
                socket.emit("draw:stroke-end", { boardId });
            }

            if (path && path.points.length > 0) {
                // Compute bounding box for the element
                const bounds = getPathBounds(path.points);
                const el = {
                    ...path,
                    id: uid(),
                    ...bounds,
                    userId: me?.userId || me?.id, // track who made it
                };
                setElements(prev => [...prev, el]);
                if (socket?.connected) socket.emit("addElement", { boardId, element: el });
                pushAction({ type: "ADD_ELEMENT", element: el });
            }
            return;
        }

        // ── Eraser tool: delete all marked elements ──
        if (isErasingRef.current) {
            isErasingRef.current = false;
            eraserPathRef.current = null;
            setEraserPath(null);

            const marked = elementsRef.current.filter(el => el.isMarkedForErasure);
            if (marked.length > 0) {
                // Clean up the marks and filter out
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
                // If nothing was marked, just clean up any stale marks
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
    };

    const getInitials = (name) => {
        if (!name) return "?";
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
    };

    const resetCamera = () => setCamera({ x: 0, y: 0, z: 1 });

    return (
        <div
            className={`relative w-full h-full overflow-hidden select-none touch-none ${tool === "hand" ? "cursor-grab active:cursor-grabbing" : tool === "eraser" ? "cursor-none" : "cursor-crosshair"}`}
            style={{ backgroundColor: isDark ? "#121212" : "#F0F0F0" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={(e) => { setMousePos({ x: -100, y: -100 }); onPointerUp(e); }}
            onPointerCancel={onPointerUp}
        >
            {bgMode === "dots" && (() => {
                const z = camera.z; const logZ = Math.log10(z); const floorLogZ = Math.floor(logZ);
                const scales = [Math.pow(10, -floorLogZ + 1), Math.pow(10, -floorLogZ), Math.pow(10, -floorLogZ - 1)];
                return (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {scales.map((s) => {
                            const step = s * 100; const size = step * z;
                            let op = 0;
                            if (size > 10 && size < 1000) {
                                if (size < 50) op = (size - 10) / 40;
                                else if (size > 400) op = 1 - (size - 400) / 600;
                                else op = 1;
                            }
                            if (op <= 0) return null;
                            const gridColor = isDark ? "255,255,255" : "0,0,0";
                            return (
                                <div key={s} className="absolute inset-0"
                                    style={{
                                        backgroundImage: `radial-gradient(circle at 1.5px 1.5px, rgba(${gridColor}, ${op * (isDark ? 0.4 : 0.3)}) 1.5px, transparent 1.5px)`,
                                        backgroundSize: `${step * z}px ${step * z}px`,
                                        backgroundPosition: `${camera.x - 1.5}px ${camera.y - 1.5}px`
                                    }}
                                />
                            );
                        })}
                    </div>
                );
            })()}
            {bgMode === "grid" && (() => {
                const z = camera.z; const logZ = Math.log10(z); const floorLogZ = Math.floor(logZ);
                const scales = [Math.pow(10, -floorLogZ + 1), Math.pow(10, -floorLogZ), Math.pow(10, -floorLogZ - 1)];
                return (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {scales.map((s) => {
                            const step = s * 100; const size = step * z;
                            let op = 0;
                            if (size > 10 && size < 1000) {
                                if (size < 50) op = (size - 10) / 40;
                                else if (size > 400) op = 1 - (size - 400) / 600;
                                else op = 1;
                            }
                            if (op <= 0) return null;
                            const majOp = op * 0.15; const minOp = op * 0.05;
                            const bS = `${(step / 5) * z}px ${(step / 5) * z}px`;
                            const bM = `${step * z}px ${step * z}px`;
                            const gridColor = isDark ? "255,255,255" : "0,0,0";
                            return (
                                <div key={s} className="absolute inset-0"
                                    style={{
                                        backgroundImage: `linear-gradient(to right, rgba(${gridColor},${minOp}) 1px, transparent 1px), linear-gradient(to bottom, rgba(${gridColor},${minOp}) 1px, transparent 1px), linear-gradient(to right, rgba(${gridColor},${majOp}) 1.5px, transparent 1.5px), linear-gradient(to bottom, rgba(${gridColor},${majOp}) 1.5px, transparent 1.5px)`,
                                        backgroundSize: `${bS}, ${bS}, ${bM}, ${bM}`,
                                        backgroundPosition: `${camera.x}px ${camera.y}px, ${camera.x}px ${camera.y}px, ${camera.x}px ${camera.y}px, ${camera.x}px ${camera.y}px`
                                    }}
                                />
                            );
                        })}
                    </div>
                );
            })()}


            {/* Live pen stroke preview */}
            <LivePathPreview currentPath={currentPath} camera={camera} />

            {/* Eraser trail preview */}
            <EraserTrailPreview eraserPath={eraserPath} camera={camera} />

            {/* Remote live strokes preview */}
            {Object.keys(remoteLiveStrokes).length > 0 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 9 }}>
                    <g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.z})`}>
                        {Object.entries(remoteLiveStrokes).map(([uid, stroke]) => {
                            if (!stroke || !stroke.points || stroke.points.length === 0) return null;
                            const outlinePoints = getStroke(stroke.points.map(p => [p.x, p.y, p.pressure || 0.5]), {
                                size: stroke.width * 2,
                                thinning: 0.5,
                                smoothing: 0.5,
                                streamline: 0.5,
                            });
                            const pathData = getSvgPathFromStroke(outlinePoints);
                            if (!pathData) return null;

                            return (
                                <path
                                    key={`remote-live-${uid}`}
                                    d={pathData}
                                    fill={stroke.color}
                                    style={{ opacity: 0.8 }}
                                />
                            );
                        })}
                    </g>
                </svg>
            )}

            <ElementsLayer
                tool={tool}
                bgMode={bgMode}
                isDark={isDark}
                elements={elements}
                camera={camera}
                boardId={boardId}
                socket={socket}
                onElementsChange={setElements}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                ghostElement={ghostElement}
                pushAction={pushAction}
                pendingEditId={pendingEditId}
                onPendingEditConsumed={clearPendingEditId}
            />

            {tool === "eraser" && (
                <div className="absolute pointer-events-none rounded-full border-2 border-red-400 bg-red-500/10" style={{ width: 24, height: 24, left: mousePos.x, top: mousePos.y, transform: "translate(-50%, -50%)", zIndex: 20 }} />
            )}

            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 25 }}>
                {Object.entries(cursors).map(([userId, c]) => {
                    const sp = worldToScreen(c.x, c.y);
                    return (
                        <div key={userId} style={{ position: "absolute", left: sp.x, top: sp.y, transform: "translate(-6px,-6px)", transition: "none" }}>
                            <div className="flex items-center gap-2">
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm" style={{ background: c.color }} />
                                <span className="text-[10px] px-2 py-0.5 rounded-full shadow-md whitespace-nowrap font-bold text-white" style={{ backgroundColor: c.color }}>{c.name}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* UI overlay container */}
            <div className="pointer-events-none">
                <div className="absolute top-4 right-4 flex flex-col items-end gap-3 z-30 pointer-events-none">
                    <div className="flex items-center gap-2">
                        {/* Participants Bubbles */}
                        <div className="flex -space-x-3 pointer-events-auto mr-2">
                            {participants.slice(0, 5).map((p, idx) => (
                                <div
                                    key={`${p.userId}-${idx}`}
                                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold shadow-sm transition-all duration-300 hover:scale-110 hover:z-10 cursor-default tooltip tooltip-bottom ${talkingUserIds.includes(p.userId) ? "ring-4 ring-green-400 animate-pulse border-white scale-110 z-10" : isDark ? "border-[#13131f]" : "border-base-100"}`}
                                    style={{ backgroundColor: p.color || "#ccc" }}
                                    data-tip={p.name}
                                >
                                    {getInitials(p.name)}
                                </div>
                            ))}
                            {participants.length > 5 && (
                                <div className={`w-10 h-10 rounded-full border-2 ${isDark ? "border-[#13131f] bg-slate-800 text-slate-300" : "border-base-100 bg-base-300 text-base-content"} flex items-center justify-center text-xs font-bold shadow-sm`}>
                                    +{participants.length - 5}
                                </div>
                            )}
                        </div>

                        <div className={`ui-container bg-white/10 backdrop-blur-lg border border-white/20 shadow-lg rounded-full px-5 py-2 flex items-center gap-3 pointer-events-auto`}>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse"></div>
                            <span className="text-sm font-semibold opacity-70">{statusMsg || "Ready"}</span>
                            <button className={`btn btn-ghost ${ghostBtnClass} btn-sm btn-circle ml-2`} onClick={() => setIsMinimapVisible(!isMinimapVisible)} title="Toggle Minimap"><MapIcon className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className={`ui-container bg-white/10 backdrop-blur-lg border border-white/20 shadow-lg rounded-xl px-3 py-2 flex items-center gap-2 pointer-events-auto`}>
                        <button className={`btn btn-sm btn-ghost ${ghostBtnClass} px-2`} title="Zoom Out" onClick={() => setCamera(p => ({ ...p, z: Math.max(p.z / 1.5, 0.1) }))}><ZoomOut className="w-4 h-4" /></button>
                        <button className={`btn btn-sm btn-ghost ${ghostBtnClass} font-mono text-sm px-3 ${isDark ? "hover:bg-white/5" : "hover:bg-base-200"}`} onClick={resetCamera}>{Math.round(camera.z * 100)}%</button>
                        <button className={`btn btn-sm btn-ghost ${ghostBtnClass} px-2`} title="Zoom In" onClick={() => setCamera(p => ({ ...p, z: Math.min(p.z * 1.5, 10) }))}><ZoomIn className="w-4 h-4" /></button>
                    </div>
                    {isMinimapVisible && (
                        <div className={`ui-container bg-white/10 backdrop-blur-lg border border-white/20 shadow-lg rounded-2xl p-2 pointer-events-auto origin-top-right`}>
                            <canvas ref={minimapCanvasRef} className={`w-48 h-32 rounded-xl border cursor-grab active:cursor-grabbing ${isDark ? "border-[#333333]" : "border-base-300"}`} style={{ backgroundColor: isDark ? "#121212" : "#f8fafc" }} onMouseDown={handleMinimapPointer} onMouseMove={handleMinimapPointer} onTouchStart={handleMinimapPointer} onTouchMove={handleMinimapPointer} />
                        </div>
                    )}
                </div>

                <div
                    ref={toolbarRef}
                    className={`ui-container absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-lg border border-white/20 shadow-lg rounded-2xl px-4 py-2 z-30 flex items-center gap-3 max-w-[95vw] flex-wrap justify-center pointer-events-auto`}
                >
                    <div className={`join ${isDark ? "bg-[#121212]/50" : "bg-base-200/50"} p-1 rounded-xl`}>
                        <button className={`btn btn-sm join-item border-none tooltip tooltip-top ${tool === "select" ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass}`} onClick={() => setTool("select")} data-tip="Select (V)"><MousePointer2 className="w-5 h-5" /></button>
                        <button className={`btn btn-sm join-item border-none tooltip tooltip-top ${tool === "pen" ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass}`} onClick={() => setTool("pen")} data-tip="Pen (P)"><Pen className="w-5 h-5" /></button>
                        <button className={`btn btn-sm join-item border-none tooltip tooltip-top ${tool === "eraser" ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass}`} onClick={() => setTool("eraser")} data-tip="Eraser (E)"><Eraser className="w-5 h-5" /></button>
                        <button className={`btn btn-sm join-item border-none tooltip tooltip-top ${tool === "text" ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass}`} onClick={() => setTool("text")} data-tip="Text (T)">
                            <Type className="w-5 h-5" />
                        </button>
                        <button className={`btn btn-sm join-item border-none tooltip tooltip-top ${tool === "hand" ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass}`} onClick={() => setTool("hand")} data-tip="Hand (H)"><Hand className="w-5 h-5" /></button>
                    </div>
                    <div className={`w-px h-8 ${isDark ? "bg-white/20" : "bg-base-300"} rounded-full`} />
                    <details className="dropdown dropdown-top dropdown-center pointer-events-auto">
                        <summary className={`btn btn-sm ${["sticky", "rect", "ellipse", "triangle", "arrow"].includes(tool) ? "bg-warning text-warning-content" : ghostBtnClass} border-none rounded-xl list-none`}>
                            <div className="flex items-center gap-2">
                                {lastShapeType === "sticky" && <StickyNote className="w-5 h-5 text-warning" />}
                                {lastShapeType === "rect" && <Square className="w-5 h-5" color={isDark ? "#ffffff" : "black"} fill="transparent" strokeWidth={2} />}
                                {lastShapeType === "ellipse" && <Circle className="w-5 h-5" color={isDark ? "#ffffff" : "black"} fill="transparent" strokeWidth={2} />}
                                {lastShapeType === "triangle" && <Triangle className="w-5 h-5" color={isDark ? "#ffffff" : "black"} fill="transparent" strokeWidth={2} />}
                                {lastShapeType === "arrow" && <ArrowRight className="w-5 h-5" color={isDark ? "#ffffff" : "black"} strokeWidth={2} />}
                                <ChevronUp className="w-4 h-4 opacity-50" />
                            </div>
                        </summary>
                        <div className={`dropdown-content z-50 p-4 shadow-2xl ${isDark ? "bg-[#1f1f1f] border-[#333333] text-white/90" : "bg-base-100 border-base-200"} rounded-2xl mb-4 border w-72 min-w-[280px] backdrop-blur-xl`}>
                            <div className="grid grid-cols-5 gap-3">
                                <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("sticky"); setLastShapeType("sticky"); }} data-tip="Sticky Note (S)"><StickyNote className="w-5 h-5 text-warning" /></button>
                                <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("rect"); setLastShapeType("rect"); }} data-tip="Rectangle (R)"><Square className="w-5 h-5" color={isDark ? "white" : "black"} fill="transparent" strokeWidth={2} /></button>
                                <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("ellipse"); setLastShapeType("ellipse"); }} data-tip="Ellipse (O)"><Circle className="w-5 h-5" color={isDark ? "white" : "black"} fill="transparent" strokeWidth={2} /></button>
                                <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("triangle"); setLastShapeType("triangle"); }} data-tip="Triangle"><Triangle className="w-5 h-5" color={isDark ? "white" : "black"} fill="transparent" strokeWidth={2} /></button>
                                <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("arrow"); setLastShapeType("arrow"); }} data-tip="Arrow (A)"><ArrowRight className="w-5 h-5" color={isDark ? "white" : "black"} strokeWidth={2} /></button>
                            </div>
                        </div>
                    </details>
                    <details className="dropdown dropdown-top dropdown-center pointer-events-auto">
                        <summary className={`btn btn-sm ${["code", "video"].includes(tool) ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass} border-none rounded-xl list-none`}>
                            <Plus className="w-5 h-5" />
                        </summary>
                        <div className={`dropdown-content z-50 p-3 shadow-2xl ${isDark ? "bg-[#1f1f1f] border-[#333333] text-white/90" : "bg-base-100 border-base-200"} rounded-2xl mb-4 border backdrop-blur-xl`}>
                            <div className="flex gap-2">
                                <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => setTool("code")} data-tip="Code (C)">
                                    <Terminal className="w-5 h-5" />
                                </button>
                                <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => setTool("video")} data-tip="Video (Y)">
                                    <Youtube className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </details>
                    <div className="flex items-center gap-2 pointer-events-auto">
                        {/* The Settings menu was moved to TestWhiteboardPage via renderTopLeftUI */}
                    </div>
                </div>

                {/* Provide the Top Left UI render slot here, floating above everything */}
                {renderTopLeftUI && (
                    <div className="ui-container absolute top-5 left-5 z-50 pointer-events-none flex items-center gap-3">
                        {renderTopLeftUI({
                            isDark,
                            setIsDark,
                            setBgMode,
                            clearBoard: () => {
                                if (window.confirm("Clear board?")) {
                                    undoStackRef.current = [];
                                    redoStackRef.current = [];
                                    setElements([]);
                                    if (socket?.connected) socket.emit("clearBoard", { boardId });
                                }
                            }
                        })}
                    </div>
                )}

                {tool === "pen" && (
                    <div
                        className={`ui-container absolute left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-lg border border-white/20 shadow-lg rounded-2xl px-4 py-2 z-30 flex items-center gap-4 pointer-events-auto`}
                        style={{ bottom: toolbarHeight + 36 }} // 24px (bottom-6) + height + 12px gap
                    >
                        <details className="dropdown dropdown-top dropdown-center pointer-events-auto">
                            <summary className="flex items-center justify-center w-10 h-10 rounded-full shadow-lg cursor-pointer ring-2 ring-offset-2 list-none ring-base-300 hover:ring-primary transition-all active:scale-95" style={{ backgroundColor: color }} />
                            <div className={`dropdown-content z-40 p-4 shadow-2xl ${isDark ? "bg-[#1f1f1f] border-[#333333] text-white/90" : "bg-base-100 border-base-200"} rounded-2xl mb-4 border w-56 backdrop-blur-xl`}>
                                <div className="grid grid-cols-4 gap-3">
                                    {["#000000", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#ffffff"].map((c) => (
                                        <button key={c} className={`w-10 h-10 rounded-full border transition-all hover:scale-110 active:scale-90 ${isDark ? "border-white/10" : "border-base-300"}`} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                                    ))}
                                </div>
                                <div className={`h-px w-full my-4 ${isDark ? "bg-white/5" : "bg-base-200"}`} />
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold uppercase tracking-widest opacity-40">Custom</span>
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className={`w-full h-9 cursor-pointer rounded-xl ${isDark ? "bg-[#121212]" : "bg-base-200"} p-1 border border-transparent`}
                                    />
                                </div>
                            </div>
                        </details>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={width}
                            onChange={e => setWidth(Number(e.target.value))}
                            className={`range range-xs range-primary w-32 ml-3 ${isDark ? "bg-white/10" : ""}`}
                        />
                    </div>
                )}
            </div>

            {/* Selection Box Visual */}
            {selectionBox && (
                <div
                    className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none"
                    style={{
                        left: Math.min(selectionBox.x * camera.z + camera.x, (selectionBox.x + selectionBox.w) * camera.z + camera.x),
                        top: Math.min(selectionBox.y * camera.z + camera.y, (selectionBox.y + selectionBox.h) * camera.z + camera.y),
                        width: Math.abs(selectionBox.w * camera.z),
                        height: Math.abs(selectionBox.h * camera.z),
                        zIndex: 40
                    }}
                />
            )}
        </div>
    );
}
