import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Trash2, Bold, Italic, AlignLeft, AlignCenter, AlignRight, RotateCcw, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Play, Loader2, RefreshCw, Youtube } from "lucide-react";
import getStroke from "perfect-freehand";

// ── perfect-freehand helpers ────────────────────────────────────────────────
function getSvgPathFromStroke(stroke) {
    if (!stroke.length) return "";
    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ["M", ...stroke[0], "Q"]
    );
    d.push("Z");
    return d.join(" ");
}

const FONTS = ["Inter", "Georgia", "monospace", "Arial", "Courier New", "Times New Roman", "Gloria Hallelujah"];

function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const DEFAULT_ELEMENT_STYLES = {
    sticky: { fill: "#fef08a", stroke: "#e2c94e", strokeWidth: 1, textColor: "#1e1e1e", fontSize: 16, fontFamily: "Gloria Hallelujah", textAlign: "center", textVerticalAlign: "middle" },
    rect: { fill: "transparent", stroke: "#000000", strokeWidth: 2, textColor: "#1e1e1e", fontSize: 14, fontFamily: "Inter", textAlign: "center", textVerticalAlign: "middle" },
    ellipse: { fill: "transparent", stroke: "#000000", strokeWidth: 2, textColor: "#1e1e1e", fontSize: 14, fontFamily: "Inter", textAlign: "center", textVerticalAlign: "middle" },
    triangle: { fill: "transparent", stroke: "#000000", strokeWidth: 2, textColor: "#1e1e1e", fontSize: 14, fontFamily: "Inter", textAlign: "center", textVerticalAlign: "middle" },
    arrow: { fill: "none", stroke: "#1e1e1e", strokeWidth: 3, textColor: "#1e1e1e", fontSize: 14, fontFamily: "Inter", textAlign: "center", textVerticalAlign: "middle" },
    text: { fill: "none", stroke: "none", strokeWidth: 0, textColor: "#1e1e1e", fontSize: 20, fontFamily: "Inter", textAlign: "left", textVerticalAlign: "top" },
    code: { fill: "#1e1e2e", stroke: "#313244", strokeWidth: 1, textColor: "#cdd6f4", fontSize: 14, fontFamily: "monospace", language: "javascript", code: "console.log('Hello, World!');", output: "" },
    video: { fill: "#000000", stroke: "#313244", strokeWidth: 1, url: "", videoId: "" },
};

const COLORS = [
    "#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6",
    "#d946ef", "#ec4899", "#1e1e1e", "#ffffff", "none"
];

function ColorMenu({ value, onChange, title, className = "" }) {
    const [previewColor, setPreviewColor] = useState(value);

    // Sync preview with prop
    useEffect(() => {
        setPreviewColor(value);
    }, [value]);

    return (
        <details className={`dropdown dropdown-top ${className}`} title={title}>
            <summary className="btn btn-xs btn-ghost p-0 h-6 w-6 min-h-0 rounded-full border border-base-200 shadow-sm overflow-hidden" style={{ backgroundColor: (value === "none" ? "transparent" : (value || "#1e1e1e")), position: "relative" }}>
                {value === "none" && <div className="absolute inset-0 bg-base-300" style={{ clipPath: "polygon(0 0, 100% 100%, 100% 90%, 10% 0)" }} />}
                <div className="absolute inset-0 hover:bg-black/10 transition-colors" />
            </summary>
            <div className="dropdown-content z-[100] p-2 shadow-2xl bg-base-100 border border-base-200 rounded-xl w-40 flex flex-wrap gap-1.5 mb-2">
                {COLORS.map(c => (
                    <button
                        key={c}
                        className={`w-6 h-6 rounded-md border border-base-200 transition-all hover:scale-110 active:scale-95 ${value === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
                        style={{ backgroundColor: c === "none" ? "transparent" : c, position: "relative", overflow: "hidden" }}
                        onClick={(e) => {
                            onChange(c);
                            e.currentTarget.closest("details").open = false;
                        }}
                    >
                        {c === "none" && <div className="absolute inset-0 bg-red-500" style={{ clipPath: "polygon(0 85%, 100% 15%, 100% 25%, 0 95%)" }} />}
                    </button>
                ))}
                <div className="w-full border-t border-base-200 my-1" />
                <div className="w-full flex justify-center">
                    <input
                        type="color"
                        value={previewColor === "none" ? "#ffffff" : previewColor}
                        onInput={e => {
                            setPreviewColor(e.target.value);
                            onChange(e.target.value, false); // Live preview ONLY
                        }}
                        onChange={e => {
                            onChange(e.target.value, true); // Final commit for history
                        }}
                        className="w-full h-6 cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                    />
                </div>
            </div>
        </details>
    );
}

/** Shape SVG renderer */
function ShapeSVG({ type, fill, stroke, strokeWidth, w, h }) {
    const sW = strokeWidth || 2; // Named sW to avoid conflict with width w
    if (type === "rect") {
        return (
            <svg width={w} height={h} className="absolute inset-0 pointer-events-none">
                <rect x={sW / 2} y={sW / 2} width={Math.max(0, w - sW)} height={Math.max(0, h - sW)} rx="8" fill={fill} stroke={stroke} strokeWidth={sW} />
            </svg>
        );
    }
    if (type === "ellipse") {
        return (
            <svg width={w} height={h} className="absolute inset-0 pointer-events-none">
                <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - sW / 2)} ry={Math.max(0, h / 2 - sW / 2)} fill={fill} stroke={stroke} strokeWidth={sW} />
            </svg>
        );
    }
    if (type === "triangle") {
        const pts = `${w / 2},${sW} ${w - sW},${h - sW} ${sW},${h - sW}`;
        return (
            <svg width={w} height={h} className="absolute inset-0 pointer-events-none">
                <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sW} strokeLinejoin="round" />
            </svg>
        );
    }
    if (type === "arrow") {
        const arrowHeadSize = 12;
        return (
            <svg width={w} height={h} className="absolute inset-0 pointer-events-none">
                <line x1={sW} y1={h / 2} x2={w - arrowHeadSize} y2={h / 2} stroke={stroke} strokeWidth={sW} strokeLinecap="round" />
                <polygon points={`${w - sW},${h / 2} ${w - arrowHeadSize},${h / 2 - arrowHeadSize / 2} ${w - arrowHeadSize},${h / 2 + arrowHeadSize / 2}`} fill={stroke} />
            </svg>
        );
    }
    if (type === "text") return null; // Text elements have no shape background
    if (type === "path") return null; // Path elements render via PathSVG below
    return null;
}

/** Vector path SVG renderer (for pen strokes) */
function PathSVG({ el, sw, sh }) {
    if (!el.points || el.points.length === 0) return null;

    // We need to translate world points relative to the element's bounding box
    // because the SVG is positioned at (el.x, el.y) by the parent wrapper
    const bounds = getPathBounds(el.points);
    const scaleX = sw / (bounds.w || 1);
    const scaleY = sh / (bounds.h || 1);

    const outlinePoints = getStroke(
        el.points.map(p => [
            (p.x - bounds.x) * scaleX,
            (p.y - bounds.y) * scaleY,
            p.pressure || 0.5
        ]),
        {
            size: (el.width || 2) * 2 * Math.min(scaleX, scaleY),
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
        }
    );

    const pathData = getSvgPathFromStroke(outlinePoints);
    if (!pathData) return null;

    return (
        <svg width={sw} height={sh} className="absolute inset-0 pointer-events-none" style={{ overflow: "visible" }}>
            <path d={pathData} fill={el.color || "#000"} stroke="none" />
        </svg>
    );
}

function getPathBounds(points) {
    if (!points || !points.length) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        const px = p?.x ?? p?.[0] ?? 0;
        const py = p?.y ?? p?.[1] ?? 0;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
    }
    if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
    const pad = 4;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

function getElementBounds(el) {
    if (!el) return { x: 0, y: 0, w: 0, h: 0 };
    if (el.type === "path") {
        return getPathBounds(el.points || []);
    }

    // For shapes with rotation, calculate the AABB of the rotated corners
    if (el.rotation) {
        const rad = (el.rotation * Math.PI) / 180;
        const cx = el.x + (el.w || 0) / 2;
        const cy = el.y + (el.h || 0) / 2;

        const corners = [
            { x: el.x || 0, y: el.y || 0 },
            { x: (el.x || 0) + (el.w || 0), y: el.y || 0 },
            { x: el.x || 0, y: (el.y || 0) + (el.h || 0) },
            { x: (el.x || 0) + (el.w || 0), y: (el.y || 0) + (el.h || 0) }
        ];

        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        corners.forEach(p => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            const rx = cx + (dx * cos - dy * sin);
            const ry = cy + (dx * sin + dy * cos);
            minX = Math.min(minX, rx);
            minY = Math.min(minY, ry);
            maxX = Math.max(maxX, rx);
            maxY = Math.max(maxY, ry);
        });

        if (minX === Infinity) return { x: el.x || 0, y: el.y || 0, w: el.w || 0, h: el.h || 0 };
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    return { x: el.x || 0, y: el.y || 0, w: el.w || 0, h: el.h || 0 };
}


// ── Precision Geometric Hit Detection ───────────────────────────────────────

function getDistToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2);
}

function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
    const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
    const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
    const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(has_neg && has_pos);
}

export function pointHitsElement(wx, wy, el) {
    // 1. Transform point to local space if rotated
    let px = wx;
    let py = wy;
    if (el.rotation) {
        const rad = (-el.rotation * Math.PI) / 180;
        const cx = el.x + el.w / 2;
        const cy = el.y + el.h / 2;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = wx - cx;
        const dy = wy - cy;
        px = cx + (dx * cos - dy * sin);
        py = cy + (dx * sin + dy * cos);
    }

    // 2. Per-type precision check
    if (el.type === "path") {
        const points = el.points || [];
        const threshold = (el.width || 2) + 5;
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            // Use local coordinates px, py for rotated paths
            if (getDistToSegment(px, py, p1.x, p1.y, p2.x, p2.y) < threshold) return true;
        }
        return false;
    }

    if (el.type === "ellipse") {
        const rx = el.w / 2;
        const ry = el.h / 2;
        const cx = el.x + rx;
        const cy = el.y + ry;
        if (rx <= 0 || ry <= 0) return false;
        return ((px - cx) ** 2) / (rx ** 2) + ((py - cy) ** 2) / (ry ** 2) <= 1;
    }

    if (el.type === "triangle") {
        const sW = el.strokeWidth || 2;
        return pointInTriangle(px, py,
            el.x + el.w / 2, el.y + sW,
            el.x + el.w - sW, el.y + el.h - sW,
            el.x + sW, el.y + el.h - sW
        );
    }

    if (el.type === "arrow") {
        const sW = el.strokeWidth || 3;
        const headSize = 12;
        // Shaft check (rectangle)
        if (px >= el.x && px <= el.x + el.w - headSize && py >= el.y + el.h / 2 - sW && py <= el.y + el.h / 2 + sW) return true;
        // Head check (triangle)
        return pointInTriangle(px, py,
            el.x + el.w, el.y + el.h / 2,
            el.x + el.w - headSize, el.y + el.h / 2 - headSize / 2,
            el.x + el.w - headSize, el.y + el.h / 2 + headSize / 2
        );
    }

    // Default: Rectangle-based HIT for rect, sticky, text (with padding), code, video
    const pad = el.type === "text" ? 5 : 0;
    return px >= el.x - pad && px <= el.x + el.w + pad && py >= el.y - pad && py <= el.y + el.h + pad;
}

/** A single rendered element */
function BoardElement({ el, camera, tool, isSelected, isMultiSelected, onSelect, onGroupSelect, onChange, onDelete, onDuplicate, onDragGuide, onStartEdit, isEditing, onEndEdit }) {
    const textRef = useRef(null);
    const elRef = useRef(null);
    const [isRunning, setIsRunning] = useState(false);

    const sx = el.x * camera.z + camera.x;
    const sy = el.y * camera.z + camera.y;
    const sw = el.w * camera.z;
    const sh = el.h * camera.z;

    // ── drag to move (Alt = duplicate, Shift = angle-snap) ───────────────────
    const handlePointerDown = (e) => {
        if (e.button === 1) return; // Allow middle-click to bubble up for panning
        if (e.button !== 0) return;
        if (tool !== "select" || isEditing) return;

        // Use the same coordinate logic as the main canvas
        const rect = elRef.current.parentElement.getBoundingClientRect();
        const scx = e.clientX - rect.left;
        const scy = e.clientY - rect.top;
        const wp = {
            x: (scx - camera.x) / camera.z,
            y: (scy - camera.y) / camera.z
        };
        const isHit = pointHitsElement(wp.x, wp.y, el);

        // If we hit nothing and it's not selected, we let the event bubble
        // to the background canvas for marquee selection or reaching through.
        if (!isHit && !isSelected) return;

        // If it's a hit or already selected, we "claim" this event.
        e.stopPropagation();

        // If Shift is held, we only toggle selection, don't start a drag
        if (e.shiftKey) {
            onSelect(el.id, true);
            return;
        }

        // When multi-selected and NOT shifting, initiate group movement
        if (isMultiSelected && onGroupSelect) {
            onGroupSelect("move", e);
            return;
        }

        // Alt+drag: create a clone, leave original in place, drag the clone
        let dragEl = el;
        if (e.altKey) {
            const clone = { ...el, id: uid() };
            onDuplicate(clone);
            dragEl = clone;
        } else {
            onSelect(el.id, e.shiftKey);
        }

        const startX = e.clientX;
        const startY = e.clientY;
        // Origin is the drag-start world position (element top-left)
        const origX = dragEl.x;
        const origY = dragEl.y;
        const beforeState = { ...dragEl };
        const commitChange = onChange;

        const onMove = (me) => {
            let nx = origX + (me.clientX - startX) / camera.z;
            let ny = origY + (me.clientY - startY) / camera.z;

            if (me.shiftKey) {
                // Snap movement direction to nearest 45°
                const dx = nx - origX;
                const dy = ny - origY;
                const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
                const dist = Math.sqrt(dx * dx + dy * dy);
                nx = origX + Math.cos(angle) * dist;
                ny = origY + Math.sin(angle) * dist;
                // Emit guide: from element center origin to current center
                const cx = origX + dragEl.w / 2;
                const cy = origY + dragEl.h / 2;
                onDragGuide?.({ x1: cx, y1: cy, x2: nx + dragEl.w / 2, y2: ny + dragEl.h / 2, angle });
            } else {
                onDragGuide?.(null);
            }

            elRef.current._lastX = nx;
            elRef.current._lastY = ny;

            let updated = { ...dragEl, x: nx, y: ny };
            if (dragEl.type === "path") {
                const dx = nx - origX;
                const dy = ny - origY;
                const newPoints = dragEl.points.map(p => ({ x: p.x + dx, y: p.y + dy, pressure: p.pressure }));
                const bounds = getPathBounds(newPoints);
                updated = { ...updated, points: newPoints, ...bounds };
            }
            commitChange(updated);
        };

        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            onDragGuide?.(null); // clear guide
            const finalX = elRef.current._lastX !== undefined ? elRef.current._lastX : dragEl.x;
            const finalY = elRef.current._lastY !== undefined ? elRef.current._lastY : dragEl.y;
            // Always clear stale position cache — critical for alt-drag where these
            // hold the CLONE's position on the ORIGINAL element's DOM ref, which
            // would cause the original to teleport on the next click.
            delete elRef.current._lastX;
            delete elRef.current._lastY;
            if (finalX !== origX || finalY !== origY) {
                let updatedFinal = { ...dragEl, x: finalX, y: finalY };
                if (dragEl.type === "path") {
                    const dx = finalX - origX;
                    const dy = finalY - origY;
                    const newPoints = dragEl.points.map(p => ({ x: p.x + dx, y: p.y + dy, pressure: p.pressure }));
                    const bounds = getPathBounds(newPoints);
                    updatedFinal = { ...updatedFinal, points: newPoints, ...bounds };
                }
                commitChange(updatedFinal, true, beforeState);
            }
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    // ── Execute Code (Hybrid Approach) ──────────────────────────────────────────
    const handleExecute = async (e) => {
        e.stopPropagation();
        if (isRunning || !el.code) return;
        setIsRunning(true);
        onChange({ ...el, output: "Executing..." });

        try {
            if (el.language === "javascript") {
                let logs = [];
                const originalLog = console.log;
                console.log = (...args) => {
                    logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                    originalLog(...args);
                };
                try {
                    // eslint-disable-next-line no-eval
                    const result = eval(el.code);
                    if (result !== undefined && logs.length === 0) logs.push(String(result));
                    onChange({ ...el, output: logs.join('\n') || "Executed without output." });
                } catch (err) {
                    onChange({ ...el, output: `Error: ${err.message}` });
                } finally {
                    console.log = originalLog;
                }
            } else if (el.language === "python") {
                if (!window.pyodide) {
                    onChange({ ...el, output: "Downloading Python (WASM Engine)... This only happens once." });
                    await new Promise((resolve, reject) => {
                        const script = document.createElement("script");
                        script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
                        script.onload = resolve;
                        script.onerror = reject;
                        document.body.appendChild(script);
                    });
                    window.pyodide = await window.loadPyodide();
                }

                let pyLogs = [];
                window.pyodide.setStdout({ batched: (str) => pyLogs.push(str) });
                window.pyodide.setStderr({ batched: (str) => pyLogs.push(str) });
                try {
                    await window.pyodide.runPythonAsync(el.code);
                    onChange({ ...el, output: pyLogs.join('\n') || "Executed without output." });
                } catch (err) {
                    onChange({ ...el, output: String(err) });
                }
            } else if (["java", "cpp", "go", "rust"].includes(el.language)) {
                // Judge0 CE API integration
                const languageIds = {
                    java: 62,   // OpenJDK 13+
                    cpp: 54,    // GCC 9.2.0
                    go: 60,     // 1.13.5
                    rust: 73    // 1.40.0
                };

                try {
                    const response = await fetch("https://ce.judge0.com/submissions?base64_encoded=false&wait=true", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            source_code: el.code,
                            language_id: languageIds[el.language]
                        })
                    });

                    const data = await response.json();

                    if (data.status?.id === 6) { // Compilation Error
                        onChange({ ...el, output: `Compilation Error:\n${data.compile_output || "No details available."}` });
                    } else if (data.status?.id > 3) { // Other Errors (Runtime, TLE, etc)
                        onChange({
                            ...el,
                            output: `Error (${data.status.description}):\n${data.stderr || data.stdout || "No details available."}`
                        });
                    } else {
                        onChange({ ...el, output: data.stdout || "Executed without output." });
                    }
                } catch (err) {
                    onChange({ ...el, output: `API Error: ${err.message}` });
                }
            } else {
                onChange({ ...el, output: `Execution for ${el.language} is not yet implemented.` });
            }
        } catch (err) {
            onChange({ ...el, output: `System Error: ${err.message}` });
        } finally {
            setIsRunning(false);
        }
    };

    // ── resize corner ─────────────────────────────────────────────────────────
    const handleResizeStart = (e, corner) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const beforeState = { ...el };
        const { x, y, w, h } = el;

        const onMove = (me) => {
            const dx = (me.clientX - startX) / camera.z;
            const dy = (me.clientY - startY) / camera.z;

            let nw = w, nh = h, nx = x, ny = y;

            // Transform world mouse delta to local delta if rotated
            let dLocX = dx, dLocY = dy;
            if (el.rotation) {
                const rad = (-el.rotation * Math.PI) / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                dLocX = dx * cos - dy * sin;
                dLocY = dx * sin + dy * cos;
            }

            if (me.altKey) {
                if (corner.includes("e")) { nw = Math.max(40, w + 2 * dLocX); nx = x - (nw - w) / 2; }
                if (corner.includes("s")) { nh = Math.max(40, h + 2 * dLocY); ny = y - (nh - h) / 2; }
                if (corner.includes("w")) { nw = Math.max(40, w - 2 * dLocX); nx = x + (w - nw) / 2; }
                if (corner.includes("n")) { nh = Math.max(40, h - 2 * dLocY); ny = y + (h - nh) / 2; }
            } else {
                if (corner.includes("e")) nw = Math.max(40, w + dLocX);
                if (corner.includes("s")) nh = Math.max(40, h + dLocY);
                if (corner.includes("w")) { nw = Math.max(40, w - dLocX); nx = x + (w - nw); }
                if (corner.includes("n")) { nh = Math.max(40, h - dLocY); ny = y + (h - nh); }
            }

            // For rotated elements, we need to adjust the center to keep the anchor fixed
            if (el.rotation && !me.altKey) {
                const rad = (el.rotation * Math.PI) / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);

                // Vector from old center to old anchor
                const anchorDirX = corner.includes("w") ? 1 : -1;
                const anchorDirY = corner.includes("n") ? 1 : -1;

                const oldCX = x + w / 2;
                const oldCY = y + h / 2;

                // Original anchor in world space
                const aX = oldCX + (anchorDirX * w / 2 * cos - anchorDirY * h / 2 * sin);
                const aY = oldCY + (anchorDirX * w / 2 * sin + anchorDirY * h / 2 * cos);

                // New center such that new anchor (opposite corner) matches old anchor
                const newCX = aX - (anchorDirX * nw / 2 * cos - anchorDirY * nh / 2 * sin);
                const newCY = aY - (anchorDirX * nw / 2 * sin + anchorDirY * nh / 2 * cos);

                nx = newCX - nw / 2;
                ny = newCY - nh / 2;
            }

            // Shift = maintain aspect ratio (uses original w/h captured at drag start)
            if (me.shiftKey && w > 0 && h > 0) {
                const ratio = w / h;
                const isHoriz = corner === "e" || corner === "w";
                const isVert = corner === "n" || corner === "s";
                if (isHoriz) {
                    // Driven by width change
                    const adjH = Math.max(40, nw / ratio);
                    if (me.altKey) { ny = y - (adjH - h) / 2; } else if (corner.includes("n")) { ny = y + (h - adjH); }
                    nh = adjH;
                } else if (isVert) {
                    // Driven by height change
                    const adjW = Math.max(40, nh * ratio);
                    if (me.altKey) { nx = x - (adjW - w) / 2; } else if (corner.includes("w")) { nx = x + (w - adjW); }
                    nw = adjW;
                } else {
                    // Diagonal: use the dominant axis
                    const dw = Math.abs(nw - w), dh = Math.abs(nh - h);
                    if (dw >= dh) {
                        const adjH = Math.max(40, nw / ratio);
                        if (me.altKey) { ny = y - (adjH - h) / 2; } else if (corner.includes("n")) { ny = y + (h - adjH); }
                        nh = adjH;
                    } else {
                        const adjW = Math.max(40, nh * ratio);
                        if (me.altKey) { nx = x - (adjW - w) / 2; } else if (corner.includes("w")) { nx = x + (w - adjW); }
                        nw = adjW;
                    }
                }
            }

            elRef.current._lastX = nx; elRef.current._lastY = ny;
            elRef.current._lastW = nw; elRef.current._lastH = nh;

            let updated = { ...el, x: nx, y: ny, w: nw, h: nh };
            if (el.type === "path") {
                const swFactor = nw / (w || 1);
                const shFactor = nh / (h || 1);
                const anchorX = corner.includes("w") ? x + w : x;
                const anchorY = corner.includes("n") ? y + h : y;
                const newPoints = el.points.map(p => ({
                    x: anchorX + (p.x - anchorX) * swFactor,
                    y: anchorY + (p.y - anchorY) * shFactor,
                    pressure: p.pressure
                }));
                const bounds = getPathBounds(newPoints);
                updated = { ...updated, points: newPoints, ...bounds };
            }
            commitChange(updated);
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            const finalX = elRef.current._lastX !== undefined ? elRef.current._lastX : el.x;
            const finalY = elRef.current._lastY !== undefined ? elRef.current._lastY : el.y;
            const finalW = elRef.current._lastW !== undefined ? elRef.current._lastW : el.w;
            const finalH = elRef.current._lastH !== undefined ? elRef.current._lastH : el.h;
            if (finalX !== x || finalY !== y || finalW !== w || finalH !== h) {
                let updatedFinal = { ...el, x: finalX, y: finalY, w: finalW, h: finalH };
                if (el.type === "path") {
                    const swFactor = finalW / (w || 1);
                    const shFactor = finalH / (h || 1);
                    const anchorX = corner.includes("w") ? x + w : x;
                    const anchorY = corner.includes("n") ? y + h : y;
                    const newPoints = el.points.map(p => ({
                        x: anchorX + (p.x - anchorX) * swFactor,
                        y: anchorY + (p.y - anchorY) * shFactor,
                        pressure: p.pressure
                    }));
                    const bounds = getPathBounds(newPoints);
                    updatedFinal = { ...updatedFinal, points: newPoints, ...bounds };
                }
                onChange(updatedFinal, true, beforeState);
            }
        };
        const commitChange = (u, p, b) => {
            if (!p) { elRef.current._lastX = u.x; elRef.current._lastY = u.y; elRef.current._lastW = u.w; elRef.current._lastH = u.h; }
            onChange(u, p, b);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    // ── custom arrow handles ──────────────────────────────────────────────────
    const handleArrowResizeStart = (e, pointType) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const beforeState = { ...el };
        const { x, y, w, h, rotation = 0 } = el;

        // Current world center
        const cx = x + w / 2;
        const cy = y + h / 2;

        // Current length is w
        const len = w;

        // Calculate current endpoints in world space
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Relative to center
        const startLx = -len / 2;
        const endLx = len / 2;

        // World endpoints
        const pStartX = cx + startLx * cos;
        const pStartY = cy + startLx * sin;
        const pEndX = cx + endLx * cos;
        const pEndY = cy + endLx * sin;

        const onMove = (me) => {
            const dx = (me.clientX - startX) / camera.z;
            const dy = (me.clientY - startY) / camera.z;

            let newPStartX = pStartX;
            let newPStartY = pStartY;
            let newPEndX = pEndX;
            let newPEndY = pEndY;

            if (pointType === "start") {
                newPStartX += dx;
                newPStartY += dy;
            } else {
                newPEndX += dx;
                newPEndY += dy;
            }

            // Calculate new properties from the two points
            const newDx = newPEndX - newPStartX;
            const newDy = newPEndY - newPStartY;
            const newLen = Math.max(10, Math.sqrt(newDx * newDx + newDy * newDy));
            const newAngle = Math.atan2(newDy, newDx) * (180 / Math.PI);

            // The new center is the midpoint of the two endpoints
            const newCx = (newPStartX + newPEndX) / 2;
            const newCy = (newPStartY + newPEndY) / 2;

            // Extract new x, y bounds (assuming height stays constant)
            const newX = newCx - newLen / 2;
            const newY = newCy - h / 2;

            const updated = {
                ...el,
                x: newX,
                y: newY,
                w: newLen,
                rotation: newAngle
            };

            commitChange(updated);
        };

        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            // Re-apply final state to trigger undo stack
            const finalU = {
                ...el,
                x: elRef.current._lastX !== undefined ? elRef.current._lastX : el.x,
                y: elRef.current._lastY !== undefined ? elRef.current._lastY : el.y,
                w: elRef.current._lastW !== undefined ? elRef.current._lastW : el.w,
                rotation: elRef.current._lastRot !== undefined ? elRef.current._lastRot : el.rotation
            };
            onChange(finalU, true, beforeState);
        };

        const commitChange = (u, p, b) => {
            if (!p) {
                elRef.current._lastX = u.x;
                elRef.current._lastY = u.y;
                elRef.current._lastW = u.w;
                elRef.current._lastRot = u.rotation;
            }
            onChange(u, p, b);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    // ── rotation handle ───────────────────────────────────────────────────────
    const handleRotateStart = (e) => {
        e.stopPropagation();
        const beforeState = { ...el };
        const origPoints = el.points;
        const origRotation = el.rotation || 0;
        const rect = elRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const onMove = (me) => {
            let angle = Math.atan2(me.clientY - cy, me.clientX - cx) * (180 / Math.PI) + 90;

            // Snapping logic: 45 degree increments (0, 45, 90, 135, 180, ...)
            const snapAngle = 45;
            const threshold = 5;
            const nearestSnap = Math.round(angle / snapAngle) * snapAngle;

            if (me.shiftKey || Math.abs(angle - nearestSnap) < threshold) {
                angle = nearestSnap;
            }

            const newRotation = Math.round(angle);
            let updated = { ...el, rotation: newRotation };

            commitChange(updated);
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            const finalRotation = elRef.current._lastRot !== undefined ? elRef.current._lastRot : el.rotation;
            if (finalRotation !== el.rotation) {
                let updatedFinal = { ...el, rotation: finalRotation };
                onChange(updatedFinal, true, beforeState);
            }
        };
        const commitChange = (u, p, b) => {
            if (!p) elRef.current._lastRot = u.rotation;
            onChange(u, p, b);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    useEffect(() => {
        if (isEditing && textRef.current) {
            // Set initial text once on focus, then leave DOM alone
            textRef.current.innerText = el.text || "";
            textRef.current._origText = el.text || ""; // Store for undo
            textRef.current.focus();
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(textRef.current);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }, [isEditing]);

    const handleEndEdit = () => {
        if (textRef.current && textRef.current.innerText !== textRef.current._origText) {
            onChange({ ...el, text: textRef.current.innerText }, true, { ...el, text: textRef.current._origText });
        }
        onEndEdit();
    };

    const valignMap = { top: "flex-start", middle: "center", bottom: "flex-end" };

    const handles = [
        { id: "nw", top: -5, left: -5, cursor: "nw-resize" },
        { id: "n", top: -5, left: "calc(50% - 4px)", cursor: "n-resize" },
        { id: "ne", top: -5, right: -5, cursor: "ne-resize" },
        { id: "e", top: "calc(50% - 4px)", right: -5, cursor: "e-resize" },
        { id: "se", bottom: -5, right: -5, cursor: "se-resize" },
        { id: "s", bottom: -5, left: "calc(50% - 4px)", cursor: "s-resize" },
        { id: "sw", bottom: -5, left: -5, cursor: "sw-resize" },
        { id: "w", top: "calc(50% - 4px)", left: -5, cursor: "w-resize" },
    ];

    // Erasure visual feedback
    const erasureStyle = el.isMarkedForErasure ? {
        opacity: 0.3,
        filter: "grayscale(1)",
        transition: "opacity 0.15s, filter 0.15s",
    } : {};

    return (
        <div
            ref={elRef}
            style={{
                position: "absolute", left: sx, top: sy, width: sw, height: sh,
                transform: `rotate(${el.rotation || 0}deg)`,
                transformOrigin: "center center",
                cursor: isEditing ? "text" : "move",
                userSelect: isEditing ? "text" : "none",
                zIndex: isSelected ? 20 : 10,
                boxSizing: "border-box",
                pointerEvents: (tool === "select" || isEditing) ? "auto" : "none",
                ...erasureStyle,
            }}
            onPointerDown={handlePointerDown}
            onDoubleClick={(e) => {
                // Precision check for double click too
                const rect = e.currentTarget.parentElement.getBoundingClientRect();
                const scx = e.clientX - rect.left;
                const scy = e.clientY - rect.top;
                const wp = {
                    x: (scx - camera.x) / camera.z,
                    y: (scy - camera.y) / camera.z
                };
                const isHit = pointHitsElement(wp.x, wp.y, el);
                if (!isHit && !isSelected) return;

                e.stopPropagation();
                if (el.type !== "path") onStartEdit(el.id);
            }}
        >
            {el.type === "code" ? (
                <div className="absolute inset-0 rounded-lg overflow-hidden flex flex-col shadow-xl" style={{ backgroundColor: el.fill, border: `${el.strokeWidth || 1}px solid ${el.stroke}` }}>
                    {/* Header */}
                    <div
                        className="bg-[#181825] flex items-center justify-between border-b border-[#313244]"
                        onPointerDown={handlePointerDown}
                        style={{ padding: `${8 * camera.z}px ${12 * camera.z}px` }}
                    >
                        <div className="flex items-center" style={{ gap: `${8 * camera.z}px` }}>
                            <div className="flex" style={{ gap: `${6 * camera.z}px` }}>
                                <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#f87171' }} />
                                <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#facc15' }} />
                                <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#4ade80' }} />
                            </div>
                            <select
                                className="bg-[#1e1e2e] text-[#cdd6f4] rounded border border-[#313244] outline-none cursor-pointer"
                                value={el.language}
                                style={{
                                    marginLeft: 8 * camera.z,
                                    fontSize: 12 * camera.z,
                                    padding: `${2 * camera.z}px ${6 * camera.z}px`
                                }}
                                onChange={(e) => {
                                    const newLang = e.target.value;
                                    const boilerplates = {
                                        javascript: "console.log('Hello from JS!');",
                                        python: "print('Hello from Python!')",
                                        java: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello from Java!\");\n    }\n}",
                                        cpp: "#include <iostream>\n\nint main() {\n    std::cout << \"Hello from C++!\" << std::endl;\n    return 0;\n}",
                                        go: "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello from Go!\")\n}",
                                        rust: "fn main() {\n    println!(\"Hello from Rust!\");\n}"
                                    };

                                    const currentCode = (el.code || "").trim();
                                    const isAnyBoilerplate = Object.values(boilerplates).some(b => b.trim() === currentCode);

                                    if (!currentCode || isAnyBoilerplate) {
                                        onChange({ ...el, language: newLang, code: boilerplates[newLang] });
                                    } else {
                                        onChange({ ...el, language: newLang });
                                    }
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                                <option value="go">Go</option>
                                <option value="rust">Rust</option>
                            </select>
                            <button
                                className="bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] border-none flex items-center justify-center rounded cursor-pointer transition-colors"
                                title="Reset to boilerplate"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => {
                                    const boilerplates = {
                                        javascript: "console.log('Hello from JS!');",
                                        python: "print('Hello from Python!')",
                                        java: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello from Java!\");\n    }\n}",
                                        cpp: "#include <iostream>\n\nint main() {\n    std::cout << \"Hello from C++!\" << std::endl;\n    return 0;\n}",
                                        go: "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello from Go!\")\n}",
                                        rust: "fn main() {\n    println!(\"Hello from Rust!\");\n}"
                                    };
                                    onChange({ ...el, code: boilerplates[el.language] });
                                }}
                                style={{
                                    width: 24 * camera.z,
                                    height: 24 * camera.z,
                                    marginLeft: 4 * camera.z
                                }}
                            >
                                <RefreshCw size={12 * camera.z} />
                            </button>
                        </div>
                        <button
                            className="bg-green-600 hover:bg-green-500 text-white border-none flex items-center font-semibold rounded cursor-pointer"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={handleExecute}
                            disabled={isRunning}
                            style={{
                                padding: `${4 * camera.z}px ${10 * camera.z}px`,
                                fontSize: 12 * camera.z,
                                gap: 4 * camera.z
                            }}
                        >
                            {isRunning ? <Loader2 size={12 * camera.z} className="animate-spin" /> : <Play size={12 * camera.z} fill="currentColor" />}
                            Run
                        </button>
                    </div>

                    {/* Editor */}
                    <div className="flex-1 relative">
                        <textarea
                            className="absolute inset-0 w-full h-full bg-transparent resize-none outline-none font-mono"
                            style={{
                                color: el.textColor,
                                fontSize: `${el.fontSize * (sw / el.w)}px`,
                                padding: 12 * camera.z,
                            }}
                            value={el.code}
                            onChange={(e) => onChange({ ...el, code: e.target.value })}
                            onMouseDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            onWheel={(e) => {
                                // Allow board zoom (bubbles to window) but stop regular internal scroll panning
                                if (e.ctrlKey || e.metaKey) return;
                                e.stopPropagation();
                            }}
                            spellCheck="false"
                            placeholder="Write your code here..."
                        />
                    </div>

                    {/* Output */}
                    {el.output !== undefined && (
                        <div
                            className="h-1/3 bg-[#11111b] border-t border-[#313244] overflow-y-auto font-mono text-[#a6adc8]"
                            onMouseDown={(e) => e.stopPropagation()}
                            onWheel={(e) => {
                                // Allow board zoom (bubbles to window) but stop regular internal scroll panning
                                if (e.ctrlKey || e.metaKey) return;
                                e.stopPropagation();
                            }}
                            style={{ padding: 8 * camera.z }}
                        >
                            <div className="text-[#6c7086] font-bold" style={{ fontSize: 11 * camera.z, marginBottom: 4 * camera.z }}>Output:</div>
                            <pre className="whitespace-pre-wrap font-mono m-0" style={{ fontSize: 12 * camera.z }}>{el.output}</pre>
                        </div>
                    )}
                </div>
            ) : el.type === "video" ? (
                <div className="absolute inset-0 rounded-lg overflow-hidden flex flex-col shadow-xl" style={{ backgroundColor: '#000', border: `${el.strokeWidth || 1}px solid ${el.stroke}` }}>
                    {/* Header */}
                    <div
                        className="bg-[#181825] flex items-center justify-between border-b border-[#313244]"
                        onPointerDown={handlePointerDown}
                        style={{ padding: `${8 * camera.z}px ${12 * camera.z}px` }}
                    >
                        <div className="flex items-center" style={{ gap: `${8 * camera.z}px` }}>
                            <div className="flex" style={{ gap: `${6 * camera.z}px` }}>
                                <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#f87171' }} />
                                <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#facc15' }} />
                                <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#4ade80' }} />
                            </div>
                            <div style={{ marginLeft: 8 * camera.z, color: '#cdd6f4', fontSize: 12 * camera.z, display: 'flex', alignItems: 'center', gap: 4 * camera.z }}>
                                <Youtube size={14 * camera.z} className="text-red-500" />
                                <span>YouTube Player</span>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 bg-[#11111b] relative flex items-center justify-center">
                        {el.videoId ? (
                            <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${el.videoId}`}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title="YouTube Video"
                                style={{ pointerEvents: isEditing ? 'none' : 'auto' }}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-4 w-full px-6 text-center">
                                <Youtube size={48 * camera.z} className="text-[#313244]" />
                                <input
                                    type="text"
                                    placeholder="Paste YouTube Link..."
                                    className="w-full bg-[#1e1e2e] text-[#cdd6f4] border border-[#313244] rounded outline-none text-center transition-all focus:border-red-500/50"
                                    style={{
                                        padding: `${8 * camera.z}px`,
                                        fontSize: 14 * camera.z
                                    }}
                                    value={el.url || ""}
                                    onChange={(e) => {
                                        const url = e.target.value;
                                        let videoId = "";
                                        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                                        const match = url.match(regExp);
                                        if (match && match[2].length === 11) {
                                            videoId = match[2];
                                        }
                                        onChange({ ...el, url, videoId });
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                />
                                <p style={{ fontSize: 11 * camera.z, color: '#6c7086' }}>
                                    Supports youtube.com and youtu.be links
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : el.type === "path" ? (
                <PathSVG el={el} sw={sw} sh={sh} />
            ) : (
                <>
                    {/* Visual Background */}
                    {el.type === "sticky" ? (
                        <div
                            className="absolute inset-0 rounded-sm"
                            style={{
                                backgroundColor: el.fill,
                                opacity: 0.9,
                                border: `${el.strokeWidth || 1}px solid ${el.stroke}`,
                                boxSizing: "border-box",
                                boxShadow: `
                                    1px 1px 1px rgba(0,0,0,0.05),
                                    ${2 * camera.z}px ${2 * camera.z}px ${5 * camera.z}px rgba(0,0,0,0.1),
                                    ${4 * camera.z}px ${4 * camera.z}px ${10 * camera.z}px rgba(0,0,0,0.05)
                                `,
                            }}
                        >
                            {/* Folded Corner Effect */}
                            <svg width="24" height="24" className="absolute bottom-0 right-0 opacity-20" style={{ transform: "scale(0.8)", transformOrigin: "bottom right" }}>
                                <path d="M 0 24 L 24 24 L 24 0 Z" fill="black" opacity="0.1" />
                                <path d="M 0 24 L 24 0 L 0 0 Z" fill="white" opacity="0.2" />
                            </svg>
                        </div>
                    ) : (
                        <ShapeSVG type={el.type} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} w={sw} h={sh} />
                    )}

                    {/* Text Area with Vertical Align */}
                    <div style={{
                        position: "absolute", inset: "10px",
                        display: "flex", flexDirection: "column",
                        justifyContent: valignMap[el.textVerticalAlign || (el.type === "text" ? "top" : "middle")] || "flex-start",
                        zIndex: 2, pointerEvents: isEditing ? "auto" : "none",
                        overflow: "hidden",
                    }}
                        onMouseDown={(e) => { if (isEditing) e.stopPropagation(); }}
                    >
                        <div
                            ref={textRef}
                            contentEditable={isEditing}
                            suppressContentEditableWarning
                            onInput={() => { if (textRef.current) onChange({ ...el, text: textRef.current.innerText }); }}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") { handleEndEdit(); }
                                e.stopPropagation();
                            }}
                            onBlur={handleEndEdit}
                            style={{
                                fontSize: (el.fontSize || 14) * (sw / el.w),
                                fontFamily: el.fontFamily || "Inter",
                                fontWeight: el.bold ? "bold" : "normal",
                                fontStyle: el.italic ? "italic" : "normal",
                                color: el.textColor || "#1e1e1e",
                                textAlign: el.textAlign || (el.type === "text" ? "left" : "center"),
                                whiteSpace: "pre-wrap", wordBreak: "break-word",
                                outline: "none", lineHeight: 1.4,
                                minHeight: "1em",
                            }}
                            dangerouslySetInnerHTML={isEditing ? undefined : { __html: (el.text || "").replace(/\n/g, "<br>") }}
                        />
                    </div>
                </>
            )}

            {/* Selection UI */}
            {isSelected && !isEditing && (
                <div className="absolute inset-0 rounded-sm pointer-events-none" style={{ border: isMultiSelected ? "1.5px solid #2563eb" : (el.type === "text" ? "1.5px dashed #2563eb" : "2px solid #2563eb"), zIndex: 3 }} />
            )}
            {isEditing && el.type === "text" && (
                <div className="absolute inset-0 rounded-sm pointer-events-none" style={{ border: "1.5px dashed #94a3b8", zIndex: 3 }} />
            )}
            {/* Only show individual resize/rotate handles when NOT multi-selected */}
            {isSelected && !isEditing && !isMultiSelected && el.type !== "arrow" && handles.map(h => (
                <div key={h.id} onPointerDown={(e) => { e.stopPropagation(); handleResizeStart(e, h.id); }}
                    className="ui-container"
                    style={{ position: "absolute", width: 9, height: 9, background: "#fff", border: "2px solid #2563eb", borderRadius: 2, cursor: h.cursor, zIndex: 4, ...h, pointerEvents: "auto" }} />
            ))}
            {isSelected && !isEditing && !isMultiSelected && el.type !== "arrow" && (
                <div onPointerDown={(e) => { e.stopPropagation(); handleRotateStart(e); }} title="Rotate"
                    className="ui-container"
                    style={{ position: "absolute", top: -30, left: "calc(50% - 8px)", width: 16, height: 16, borderRadius: "50%", background: "#2563eb", cursor: "grab", zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto" }}>
                    <RotateCcw size={10} color="#fff" />
                </div>
            )}

            {/* Custom Arrow Endpoint Handles */}
            {isSelected && !isEditing && !isMultiSelected && el.type === "arrow" && (
                <>
                    <div
                        onPointerDown={(e) => handleArrowResizeStart(e, "start")}
                        className="ui-container"
                        style={{
                            position: "absolute",
                            top: "calc(50% - 6px)",
                            left: -6,
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: "#fff",
                            border: "2px solid #2563eb",
                            cursor: "pointer",
                            zIndex: 6,
                            pointerEvents: "auto"
                        }}
                    />
                    <div
                        onPointerDown={(e) => handleArrowResizeStart(e, "end")}
                        className="ui-container"
                        style={{
                            position: "absolute",
                            top: "calc(50% - 6px)",
                            right: -6,
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: "#fff",
                            border: "2px solid #2563eb",
                            cursor: "pointer",
                            zIndex: 6,
                            pointerEvents: "auto"
                        }}
                    />
                </>
            )}
        </div>
    );
}

const MemoizedBoardElement = React.memo(BoardElement);
const MemoizedColorMenu = React.memo(ColorMenu);

/** Ghost Preview while dragging to draw */
function GhostElement({ ghost, camera }) {
    if (!ghost) return null;
    const sx = ghost.x * camera.z + camera.x;
    const sy = ghost.y * camera.z + camera.y;
    const sw = ghost.w * camera.z;
    const sh = ghost.h * camera.z;
    return (
        <div style={{
            position: "absolute",
            left: sx,
            top: sy,
            width: sw,
            height: sh,
            transform: `rotate(${ghost.rotation || 0}deg)`,
            transformOrigin: "center center",
            zIndex: 25,
            pointerEvents: "none",
            opacity: 0.6
        }}>
            {ghost.type === "sticky" ? (
                <div className="absolute inset-0 rounded-md shadow-md" style={{ backgroundColor: ghost.fill, border: `${ghost.strokeWidth || 2}px solid ${ghost.stroke}` }} />
            ) : (
                <ShapeSVG type={ghost.type} fill={ghost.fill} stroke={ghost.stroke} strokeWidth={ghost.strokeWidth} w={sw} h={sh} />
            )}
        </div>
    );
}

export default React.memo(function ElementsLayer({
    tool, elements, camera, boardId, socket,
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

    useEffect(() => {
        const onKey = (e) => {
            if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0 && !editingId) {
                if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.contentEditable === "true") return;
                e.preventDefault();
                handleDelete();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedIds, editingId, handleDelete]);

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
    const [tState, setTState] = useState(null);
    const tStateRef = useRef(null);

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

    const groupHandles = [
        { id: "nw", top: -6, left: -6, cursor: "nw-resize" },
        { id: "ne", top: -6, right: -6, cursor: "ne-resize" },
        { id: "sw", bottom: -6, left: -6, cursor: "sw-resize" },
        { id: "se", bottom: -6, right: -6, cursor: "se-resize" },
    ];

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
                {selectedIds.length > 1 && groupBounds && !editingId && (() => {
                    const activeBounds = tState?.groupBounds || groupBounds;
                    return (
                        <div
                            className="absolute border-2 border-primary pointer-events-auto rounded-sm ring-4 ring-primary/5 shadow-[0_0_15px_rgba(37,99,235,0.15)]"
                            style={{
                                left: activeBounds.x * camera.z + camera.x - 4,
                                top: activeBounds.y * camera.z + camera.y - 4,
                                width: activeBounds.w * camera.z + 8,
                                height: activeBounds.h * camera.z + 8,
                                zIndex: 20,
                                transformOrigin: "center center",
                                transform: `rotate(${tState?.currentRotation || 0}deg)`,
                                cursor: tState?.type === "move" ? "grabbing" : "grab"
                            }}
                            onPointerDown={(e) => {
                                // 1. Calculate world point
                                const rect = e.currentTarget.parentElement.getBoundingClientRect();
                                const wp = {
                                    x: (e.clientX - rect.left - camera.x) / camera.z,
                                    y: (e.clientY - rect.top - camera.y) / camera.z
                                };

                                // 2. Precision yield check (unselected ONLY)
                                // We check if an unselected element is hit precisely under the group box
                                const elementsCopy = [...elementsRef.current].reverse();
                                const hitUnselected = elementsCopy.find(el =>
                                    !selectedIds.includes(el.id) && pointHitsElement(wp.x, wp.y, el)
                                );

                                if (hitUnselected) {
                                    handleSelect(hitUnselected.id, e.shiftKey);
                                    return;
                                }

                                // 3. Otherwise, drag the group
                                onGroupTransformStart("move", e);
                            }}
                        >
                            {/* Rotation Handle */}
                            <div
                                className="absolute -top-12 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-base-100 border-2 border-primary flex items-center justify-center cursor-alias hover:bg-primary hover:text-white transition-all shadow-md group pointer-events-auto"
                                onPointerDown={(e) => onGroupTransformStart("rotate", e)}
                                title="Rotate (Hold Shift to snap)"
                            >
                                <RotateCcw size={16} />
                                <div className="absolute top-10 w-0.5 h-4 bg-primary" />
                            </div>

                            {/* Scale Handles */}
                            {groupHandles.map(h => (
                                <div
                                    key={h.id}
                                    className="absolute w-4 h-4 bg-base-100 border-2 border-primary rounded-sm shadow-sm hover:scale-125 transition-transform pointer-events-auto"
                                    style={{
                                        ...h,
                                        cursor: h.cursor,
                                        transform: `translate(${h.left === -6 ? '-50%' : '50%'}, ${h.top === -6 ? '-50%' : '50%'})`
                                    }}
                                    onPointerDown={(e) => onGroupTransformStart(`scale-${h.id}`, e)}
                                />
                            ))}
                        </div>
                    );
                })()}
            </div>

            {/* Selection Toolbar */}
            {selectedItems.length > 0 && !editingId && groupBounds && (() => {
                const activeBounds = tState?.groupBounds || groupBounds;
                return (
                    <div
                        className="ui-container fixed bg-base-100 border border-base-200 rounded-2xl shadow-2xl px-2 py-1.5 flex items-center gap-1 z-50 flex-nowrap shrink-0 animate-in fade-in zoom-in duration-200"
                        style={{
                            top: Math.max(80, (activeBounds.y * camera.z + camera.y) - 80),
                            left: (activeBounds.x * camera.z + camera.x) + (activeBounds.w * camera.z) / 2,
                            transform: "translateX(-50%)",
                            pointerEvents: "auto",
                            minWidth: "max-content",
                        }}
                        onPointerDown={e => e.stopPropagation()}
                    >
                        {(() => {
                            const first = selectedItems[0];
                            const isAllSameType = selectedItems.every(ei => ei.type === first.type);

                            return (
                                <>
                                    {isAllSameType && first.type === "path" ? (
                                        <div className="flex items-center gap-1 px-1">
                                            <MemoizedColorMenu value={first.color || "#000"} onChange={(c, persist = true) => updateStyle({ color: c }, persist)} title="Stroke Color" />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-1 px-1">
                                                <div className="flex items-center gap-1.5 bg-base-200/50 p-1 rounded-lg">
                                                    <MemoizedColorMenu value={first.fill} onChange={(f, persist = true) => updateStyle({ fill: f }, persist)} title="Fill Color" />
                                                    <MemoizedColorMenu value={first.stroke} onChange={(s, persist = true) => updateStyle({ stroke: s }, persist)} title="Border Color" />
                                                </div>
                                                {(first.strokeWidth !== undefined) && (
                                                    <input type="range" min="0" max="10" value={first.strokeWidth} onChange={e => updateStyle({ strokeWidth: Number(e.target.value) })} className="range range-xs range-primary w-12" title="Border Width" />
                                                )}
                                            </div>

                                            {first.text !== undefined && (
                                                <>
                                                    <div className="w-px h-6 bg-base-300 mx-1" />
                                                    <div className="flex items-center gap-1 px-1">
                                                        <MemoizedColorMenu value={first.textColor} onChange={(c, persist = true) => updateStyle({ textColor: c }, persist)} title="Text Color" />
                                                        <select className="select select-xs select-bordered" style={{ width: "110px", fontSize: "11px" }} value={first.fontFamily || "Inter"} onChange={e => updateStyle({ fontFamily: e.target.value })} title="Font Family">
                                                            {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                                                        </select>
                                                        <input type="number" min="8" max="120" value={first.fontSize || 16} onChange={e => updateStyle({ fontSize: Number(e.target.value) })} className="input input-xs input-bordered w-14 text-center" title="Font Size" />
                                                        <div className="flex gap-0.5">
                                                            <button className={`btn btn-xs btn-ghost ${first.bold ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ bold: !first.bold })} title="Bold"><Bold size={12} /></button>
                                                            <button className={`btn btn-xs btn-ghost ${first.italic ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ italic: !first.italic })} title="Italic"><Italic size={12} /></button>
                                                        </div>
                                                        <div className="w-px h-4 bg-base-300 mx-0.5" />
                                                        <div className="flex gap-0.5">
                                                            <button className={`btn btn-xs btn-ghost ${first.textAlign === "left" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textAlign: "left" })} title="Align Left"><AlignLeft size={12} /></button>
                                                            <button className={`btn btn-xs btn-ghost ${first.textAlign === "center" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textAlign: "center" })} title="Align Center"><AlignCenter size={12} /></button>
                                                            <button className={`btn btn-xs btn-ghost ${first.textAlign === "right" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textAlign: "right" })} title="Align Right"><AlignRight size={12} /></button>
                                                        </div>
                                                        <div className="w-px h-4 bg-base-300 mx-0.5" />
                                                        <div className="flex gap-0.5">
                                                            <button className={`btn btn-xs btn-ghost ${first.textVerticalAlign === "top" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textVerticalAlign: "top" })} title="Align Top"><AlignVerticalJustifyStart size={12} /></button>
                                                            <button className={`btn btn-xs btn-ghost ${first.textVerticalAlign === "middle" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textVerticalAlign: "middle" })} title="Align Middle"><AlignVerticalJustifyCenter size={12} /></button>
                                                            <button className={`btn btn-xs btn-ghost ${first.textVerticalAlign === "bottom" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textVerticalAlign: "bottom" })} title="Align Bottom"><AlignVerticalJustifyEnd size={12} /></button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                    <div className="w-px h-6 bg-base-300 mx-1" />
                                    <button className="btn btn-xs btn-ghost btn-square text-error hover:bg-error/10" onClick={handleDelete} title="Delete element"><Trash2 size={12} /></button>
                                </>
                            );
                        })()}
                    </div>
                );
            })()}
        </>
    );
});
