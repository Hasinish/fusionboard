import React, { useRef, useState, useEffect } from "react";
import { RotateCcw, Play, Loader2, RefreshCw, Youtube, Trash2 } from "lucide-react";
import getStroke from "perfect-freehand";
import { ShapeSVG, PathSVG } from "./ShapeRenderers";
import { getPathBounds, pointHitsElement } from "./geometryUtils";
import GraphElement from "./graph/GraphElement";
import MermaidRenderer from "./MermaidRenderer";
import { CodeTerminal } from "./CodeTerminal";
import { useBoardElementContent } from "../../lib/yjsBoard";
import { BOARD_COMMIT_ORIGIN, BOARD_RESET_ORIGIN } from "../../lib/yjsConstants";
import { API_URL } from "../../lib/api";

export { pointHitsElement, boxHitsElement } from "./geometryUtils";

export const valignMap = {
    top: "flex-start",
    middle: "center",
    bottom: "flex-end",
};

export function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function ImageBlock({ el, sw, sh, camera }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const isUploading = !el.driveFileId;
    const token = localStorage.getItem("token");
    const src = isUploading ? null : `${API_URL}/drive/download/${el.driveFileId}?token=${token}&workspaceId=${el.workspaceId}`;

    return (
        <div className="absolute inset-0 select-none overflow-hidden flex items-center justify-center rounded-lg" style={{ zIndex: 1, backgroundColor: "rgba(0,0,0,0.04)" }}>
            {(isUploading || (loading && !error)) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ zIndex: 2 }}>
                    <Loader2 
                        className="animate-spin" 
                        style={{ width: Math.max(24, sw * 0.06), height: Math.max(24, sh * 0.06), color: "#888" }} 
                    />
                    {isUploading && (
                        <span style={{ fontSize: Math.max(10, 11 * camera.z), color: "#888" }}>Uploading…</span>
                    )}
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-lg" style={{ zIndex: 2 }}>
                    <span style={{ fontSize: Math.max(10, 12 * camera.z), color: "#888" }}>⚠ Image failed to load</span>
                </div>
            )}
            {src && (
                <img
                    src={src}
                    alt=""
                    draggable={false}
                    onLoad={() => setLoading(false)}
                    onError={() => { setLoading(false); setError(true); }}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "fill",
                        pointerEvents: "none",
                        opacity: loading ? 0 : 1,
                        transition: "opacity 0.3s ease",
                    }}
                />
            )}
        </div>
    );
}

function getTerminalSegments(events, fallbackText = "") {
    if (!Array.isArray(events) || events.length === 0) {
        return [{ kind: "output", text: fallbackText || "" }];
    }

    return events.map((event) => ({
        kind: event?.kind || "output",
        text: event?.text || ""
    }));
}

function RecordedTerminal({ el, camera, height, segments }) {
    const zs = camera?.z || 1;
    const inputDraft = el.terminalInputDraft || "";

    const getKindColor = (kind) => {
        switch (kind) {
            case "system": return "#89b4fa";
            case "input": return "#89dceb";
            case "error": return "#f38ba8";
            default: return "#cdd6f4";
        }
    };

    return (
        <div
            className="border-t border-[#313244] shrink-0 bg-[#11111b] flex flex-col text-[#cdd6f4]"
            style={{ height }}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => {
                if (e.ctrlKey || e.metaKey) return;
                e.stopPropagation();
            }}
        >
            <div className="flex justify-between items-center px-2 shrink-0" style={{ height: 20 * zs }}>
                <span className="text-[#6c7086] font-bold" style={{ fontSize: 11 * zs }}>
                    Interactive Terminal ({el.language})
                </span>
                <span className="text-[#f38ba8] bg-[#313244] rounded font-bold select-none" style={{ fontSize: 10 * zs, padding: `${2 * zs}px ${6 * zs}px` }}>
                    KILL
                </span>
            </div>
            <div className="flex-1 overflow-auto px-1 font-mono custom-scrollbar" style={{ fontSize: 12 * zs }}>
                {segments.map((seg, i) => (
                    <span key={i} style={{ color: getKindColor(seg.kind), whiteSpace: "pre-wrap" }}>
                        {seg.kind === "input" ? `> ${seg.text}` : seg.text}
                    </span>
                ))}
            </div>
            <div className="flex items-center gap-1 px-1 shrink-0 border-t border-[#313244]" style={{ padding: `${3 * zs}px ${4 * zs}px` }}>
                <div
                    className="flex-1 bg-[#1e1e2e] text-[#89b4fa] border border-[#313244] rounded font-mono truncate"
                    style={{ fontSize: 12 * zs, padding: `${2 * zs}px ${6 * zs}px` }}
                >
                    {inputDraft}
                </div>
                <span className="text-[#f38ba8] bg-[#313244] rounded font-bold select-none" style={{ fontSize: 10 * zs, padding: `${2 * zs}px ${6 * zs}px` }}>
                    Ctrl+C
                </span>
            </div>
        </div>
    );
}

/** A sub-component that handles the character-level shared text binding for code blocks */
function SharedCodeEditor({ id, boardStore, el, onChange, isViewer, camera, sw }) {
    const sharedText = useBoardElementContent(boardStore, id);
    const textareaRef = useRef(null);
    const [localValue, setLocalValue] = useState(el.code || "");
    const isRemoteUpdateRef = useRef(false);

    useEffect(() => {
        const nextValue = sharedText ? sharedText.toString() : (el.code || "");
        setLocalValue((currentValue) => (
            currentValue === nextValue ? currentValue : nextValue
        ));
    }, [sharedText, el.code, id]);

    // Track remote changes
    useEffect(() => {
        if (!sharedText) return;

        const observer = (event) => {
            if (event.transaction.origin === BOARD_COMMIT_ORIGIN) return;

            // Remote update - need to preserve cursor
            isRemoteUpdateRef.current = true;
            const textarea = textareaRef.current;
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                setLocalValue(sharedText.toString());

                // Restore selection after React render
                requestAnimationFrame(() => {
                    textarea.setSelectionRange(start, end);
                    isRemoteUpdateRef.current = false;
                });
            } else {
                setLocalValue(sharedText.toString());
                isRemoteUpdateRef.current = false;
            }
        };

        sharedText.observe(observer);
        return () => sharedText.unobserve(observer);
    }, [sharedText, isViewer]);

    const handleLocalChange = (e) => {
        if (isRemoteUpdateRef.current) return;
        const nextValue = e.target.value;
        const prevValue = localValue;
        setLocalValue(nextValue);

        if (!sharedText) return;

        // Calculate the first index where old and new text differ
        const minLen = Math.min(prevValue.length, nextValue.length);
        let start = 0;
        while (start < minLen && prevValue[start] === nextValue[start]) start++;

        // Calculate the last index where old and new text differ (from the end)
        let endOld = prevValue.length;
        let endNew = nextValue.length;
        while (endOld > start && endNew > start && prevValue[endOld - 1] === nextValue[endNew - 1]) {
            endOld--;
            endNew--;
        }

        const deleteCount = endOld - start;
        const insertText = nextValue.slice(start, endNew);

        boardStore.transact(() => {
            // Delete the changed range from the old text, then insert the new text
            if (deleteCount > 0) {
                sharedText.delete(start, deleteCount);
            }
            if (insertText.length > 0) {
                sharedText.insert(start, insertText);
            }

            // Also update the metadata "code" property for the terminal to read
            onChange({ ...el, code: nextValue }, false);
        }, BOARD_COMMIT_ORIGIN);
    };

    return (
        <textarea
            ref={textareaRef}
            className="absolute inset-0 w-full h-full bg-transparent resize-none outline-none font-mono"
            style={{
                color: el.textColor,
                fontSize: `${el.fontSize * (sw / el.w)}px`,
                padding: 12 * camera.z,
            }}
            value={localValue}
            readOnly={isViewer}
            onChange={handleLocalChange}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Tab") {
                    e.preventDefault();
                    const start = e.target.selectionStart;
                    const insertedText = "    ";
                    if (sharedText) {
                        boardStore.transact(() => {
                            sharedText.insert(start, insertedText);
                            onChange({ ...el, code: sharedText.toString() }, false);
                        });
                        setLocalValue(sharedText.toString());
                        requestAnimationFrame(() => {
                            e.target.setSelectionRange(start + 4, start + 4);
                        });
                    }
                } else if (e.key === "Enter") {
                    // Handled by default but we want smart indent
                    // Since it's complex with Y.Text, we'll let default happen for now
                    // or implement a full insert logic here.
                }
            }}
            onWheel={(e) => {
                if (e.ctrlKey || e.metaKey) return;
                e.stopPropagation();
            }}
            spellCheck="false"
            placeholder="Write your code here..."
        />
    );
}

/** A sub-component that handles character-level shared text for Mermaid diagrams */
function SharedMermaidEditor({ id, boardStore, el, onChange, onEndEdit, isViewer, camera, sw }) {
    const sharedText = useBoardElementContent(boardStore, id);
    const textareaRef = useRef(null);
    const [localValue, setLocalValue] = useState(el.text || "");
    const isRemoteUpdateRef = useRef(false);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    }, []);

    useEffect(() => {
        if (!sharedText) {
            if (el.text && el.text !== localValue) setLocalValue(el.text);
            return;
        }
        const nextValue = sharedText.toString();
        // Only overwrite localValue if sharedText has actual content, 
        // or if el.text is also empty (meaning it's a truly empty element).
        // This prevents the "flash to empty" during Yjs initialization.
        if (nextValue === "" && el.text && el.text !== "") {
            return;
        }
        if (nextValue !== localValue) {
            setLocalValue(nextValue);
        }
    }, [sharedText, el.text, id]);

    useEffect(() => {
        if (!sharedText) return;
        const observer = (event) => {
            if (event.transaction.origin === BOARD_COMMIT_ORIGIN) return;
            isRemoteUpdateRef.current = true;
            const textarea = textareaRef.current;
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                setLocalValue(sharedText.toString());
                requestAnimationFrame(() => {
                    textarea.setSelectionRange(start, end);
                    isRemoteUpdateRef.current = false;
                });
            } else {
                setLocalValue(sharedText.toString());
                isRemoteUpdateRef.current = false;
            }
        };
        sharedText.observe(observer);
        return () => sharedText.unobserve(observer);
    }, [sharedText, isViewer]);

    const handleLocalChange = (e) => {
        if (isRemoteUpdateRef.current) return;
        const nextValue = e.target.value;
        const prevValue = localValue;
        setLocalValue(nextValue);
        if (!sharedText) return;

        const minLen = Math.min(prevValue.length, nextValue.length);
        let start = 0;
        while (start < minLen && prevValue[start] === nextValue[start]) start++;
        let endOld = prevValue.length;
        let endNew = nextValue.length;
        while (endOld > start && endNew > start && prevValue[endOld - 1] === nextValue[endNew - 1]) {
            endOld--;
            endNew--;
        }
        const deleteCount = endOld - start;
        const insertText = nextValue.slice(start, endNew);

        boardStore.transact(() => {
            if (deleteCount > 0) sharedText.delete(start, deleteCount);
            if (insertText.length > 0) sharedText.insert(start, insertText);
            onChange({ ...el, text: nextValue }, false);
        }, BOARD_COMMIT_ORIGIN);
    };

    return (
        <textarea
            ref={textareaRef}
            className="absolute inset-0 w-full h-full resize-none outline-none font-mono"
            style={{
                color: "#ffffff",
                backgroundColor: "rgba(10, 10, 15, 0.95)",
                fontSize: `${(el.fontSize || 14) * (sw / el.w)}px`,
                padding: 12 * camera.z,
                borderRadius: 8 * camera.z,
                zIndex: 50,
                border: "1px solid rgba(255,255,255,0.2)"
            }}
            autoFocus
            value={localValue}
            readOnly={isViewer}
            onChange={handleLocalChange}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
                if (e.key === "Escape") { onEndEdit?.(); return; }
                e.stopPropagation();
            }}
            onWheel={(e) => {
                if (e.ctrlKey || e.metaKey) return;
                e.stopPropagation();
            }}
            spellCheck="false"
        />
    );
}

/** A single rendered element */
export function BoardElement({ el, boardStore, camera, tool, isSelected, isMultiSelected, onSelect, onGroupSelect, onChange, onDelete, onDuplicate, onDragGuide, onStartEdit, isEditing, onEndEdit, isViewer = false, isDarkMode = false, onOpenSidebar, sidebarElementId, onSidebarElementIdChange, isSidebarOpen }) {
    const textRef = useRef(null);
    const elRef = useRef(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isTerminalActive, setIsTerminalActive] = useState(false);
    const [terminalSessionKey, setTerminalSessionKey] = useState(0);
    const [localTerminalHeight, setLocalTerminalHeight] = useState(null);

    const sx = el.x * camera.z + camera.x;
    const sy = el.y * camera.z + camera.y;
    const sw = el.w * camera.z;
    const sh = el.h * camera.z;

    const effectiveTerminalHeight = localTerminalHeight || el.terminalHeight || (sh / 3);
    const terminalSegments = getTerminalSegments(el.terminalEvents, el.terminalTranscript || el.terminalScreen || "");
    const shouldShowRecordedTerminal = isViewer && (el.terminalActive || terminalSegments.some(s => s.text)) && !isTerminalActive;

    // ── drag to move (Alt = duplicate, Shift = angle-snap) ───────────────────
    const handlePointerDown = (e) => {
        if (e.button === 1 || tool === "hand") return; // Middle click or hand tool
        if (e.button !== 0) return;
        if (isViewer) return; // Viewers cannot drag elements
        if (!tool.startsWith("select") || isEditing) return;

        // The parent element is the ElementsLayer which has NO camera translation applied.
        // We must subtract camera.x/y ourselves to get pure world space coordinates.
        // ALWAYS use elRef.current.parentElement (ElementsLayer) as the absolute reference frame.
        const rect = elRef.current.parentElement.getBoundingClientRect();
        const wp = {
            x: (e.clientX - rect.left - camera.x) / camera.z,
            y: (e.clientY - rect.top - camera.y) / camera.z
        };
        // If already selected, the entire bounding box becomes grabbable to prevent accidental deselection
        const isHit = isSelected || pointHitsElement(wp.x, wp.y, el, camera.z);

        // If we missed the stroke, pass the click through to whatever is below
        if (!isHit) {
            // Temporarily remove ourselves from hit-testing
            elRef.current.style.pointerEvents = 'none';
            const below = document.elementFromPoint(e.clientX, e.clientY);
            elRef.current.style.pointerEvents = '';
            // Re-dispatch to the element underneath (another shape, or the canvas bg)
            if (below) {
                below.dispatchEvent(new PointerEvent('pointerdown', {
                    bubbles: true,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    button: e.button,
                    buttons: e.buttons,
                    shiftKey: e.shiftKey,
                    altKey: e.altKey,
                    ctrlKey: e.ctrlKey,
                    metaKey: e.metaKey,
                }));
            }
            e.stopPropagation();
            return;
        }

        // If it's a hit, we "claim" this event.
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
            commitChange(updated, false, "DRAG_PREVIEW");
        };

        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            onDragGuide?.(null); // clear guide
            const finalX = elRef.current?._lastX !== undefined ? elRef.current._lastX : dragEl.x;
            const finalY = elRef.current?._lastY !== undefined ? elRef.current._lastY : dragEl.y;
            // Always clear stale position cache — critical for alt-drag where these
            // hold the CLONE's position on the ORIGINAL element's DOM ref, which
            // would cause the original to teleport on the next click.
            if (elRef.current) {
                delete elRef.current._lastX;
                delete elRef.current._lastY;
            }
            if (finalX !== origX || finalY !== origY) {
                let updatedFinal = { ...dragEl, x: finalX, y: finalY };
                if (dragEl.type === "path") {
                    const dx = finalX - origX;
                    const dy = finalY - origY;
                    const newPoints = dragEl.points.map(p => ({ x: p.x + dx, y: p.y + dy, pressure: p.pressure }));
                    const bounds = getPathBounds(newPoints);
                    updatedFinal = { ...updatedFinal, points: newPoints, ...bounds };
                }
                onChange(updatedFinal, true, undefined, beforeState);
            }
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    // ── Execute Code (Native Terminal Approach) ─────────────────────────────────
    const [codeToRun, setCodeToRun] = useState("");

    // ── Execute Code (Native Terminal Approach) ─────────────────────────────────
    const handleExecute = async (e) => {
        if (e) e.stopPropagation();

        // 1. Get the absolute latest code from the shared Y.Text buffer
        const shared = boardStore.getContent(el.id);
        const latestCode = shared ? shared.toString() : el.code;

        if (!latestCode) return;

        // 2. Sync it to the metadata property (so it's saved in the document)
        onChange({ id: el.id, code: latestCode, terminalTranscript: "", terminalScreen: "", terminalEvents: [], terminalInputDraft: "", terminalActive: true }, true);

        // 3. Set the code to run in local state to guarantee the terminal sees it immediately
        setCodeToRun(latestCode);

        // 4. Force a fresh terminal mount with the new code
        if (isTerminalActive) {
            setIsTerminalActive(false);
            // Tiny delay to ensure React cycles the component
            setTimeout(() => {
                setIsTerminalActive(true);
                setTerminalSessionKey(Date.now());
            }, 50);
        } else {
            setIsTerminalActive(true);
            setTerminalSessionKey(Date.now());
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
            commitChange(updated, false, "DRAG_PREVIEW");
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
                onChange(updatedFinal, true, undefined, beforeState);
            }
        };
        const commitChange = (u, p, o) => {
            if (!p || o === "DRAG_PREVIEW") { elRef.current._lastX = u.x; elRef.current._lastY = u.y; elRef.current._lastW = u.w; elRef.current._lastH = u.h; }
            onChange(u, p, o);
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

            commitChange(updated, false, "DRAG_PREVIEW");
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
            onChange(finalU, true, undefined, beforeState);
        };

        const commitChange = (u, p, o, b) => {
            if (!p || o === "DRAG_PREVIEW") {
                elRef.current._lastX = u.x;
                elRef.current._lastY = u.y;
                elRef.current._lastW = u.w;
                elRef.current._lastRot = u.rotation;
            }
            // o is the custom origin (e.g., "DRAG_PREVIEW")
            // Call onChange(updated, persist, origin) 
            // Warning: ElementLayer's onChange doesn't take beforeState directly, but we can pass it if we want.
            // ElementsLayer.jsx handleChange handles `beforeState` tracking? No, UndoManager tracks it automatically!
            onChange(u, p, o);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    // ── rotation handle ───────────────────────────────────────────────────────
    const handleRotateStart = (e) => {
        e.stopPropagation();
        const beforeState = { ...el };
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

            commitChange(updated, false, "DRAG_PREVIEW");
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            const finalRotation = elRef.current._lastRot !== undefined ? elRef.current._lastRot : el.rotation;
            if (finalRotation !== el.rotation) {
                let updatedFinal = { ...el, rotation: finalRotation };
                onChange(updatedFinal, true, undefined, beforeState);
            }
        };
        const commitChange = (u, p, o, b) => {
            if (!p || o === "DRAG_PREVIEW") elRef.current._lastRot = u.rotation;
            onChange(u, p, o);
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
            onChange({ ...el, text: textRef.current.innerText }, true, undefined, { ...el, text: textRef.current._origText });
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


    const isDomBlock = ["text", "code", "video", "graph", "sticky", "mermaid"].includes(el.type);
    const shouldReceivePointer = isEditing || 
        tool === "select" || 
        (tool === "select-blocks" && isDomBlock) || 
        (tool === "select-shapes" && !isDomBlock);

    return (
        <div
            ref={elRef}
            style={{
                position: "absolute", left: sx, top: sy, width: sw, height: sh,
                transform: `rotate(${el.rotation || 0}deg)`,
                transformOrigin: "center center",
                cursor: (isEditing && el.type !== "graph") ? "text" : (isViewer ? "default" : "move"),
                userSelect: isEditing ? "text" : "none",
                zIndex: isSelected ? 20 : 10,
                boxSizing: "border-box",
                pointerEvents: shouldReceivePointer ? "auto" : "none",
                ...erasureStyle,
            }}
            onPointerDown={handlePointerDown}
            onDoubleClick={(e) => {
                if (isViewer) return; // Viewers cannot edit text
                // Precision check for double click relative to absolute canvas parent
                const rect = elRef.current.parentElement.getBoundingClientRect();
                const wp = {
                    x: (e.clientX - rect.left - camera.x) / camera.z,
                    y: (e.clientY - rect.top - camera.y) / camera.z
                };
                // If already selected, double-clicking anywhere inside bounds activates edit
                const isHit = isSelected || pointHitsElement(wp.x, wp.y, el, camera.z);
                if (!isHit) return;

                e.stopPropagation();
                if (!["path", "graph", "code", "video"].includes(el.type)) {
                    onStartEdit(el.id);
                }
            }}
        >
            {(isSelected || isEditing || ["video", "code", "graph", "mermaid", "text", "sticky", "rect", "ellipse", "triangle", "arrow", "line", "path", "image"].includes(el.type)) ? (
                <>
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
                                        className="bg-[#1e1e2e] text-[#cdd6f4] rounded border border-[#313244] outline-none cursor-pointer disabled:cursor-default"
                                        value={el.language}
                                        disabled={isViewer}
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
                                                const newCode = boilerplates[newLang];
                                                const shared = boardStore.getContent(el.id);
                                                if (shared) {
                                                    boardStore.transact(() => {
                                                        shared.delete(0, shared.length);
                                                        shared.insert(0, newCode);
                                                        onChange({ ...el, language: newLang, code: newCode }, true);
                                                    }, BOARD_RESET_ORIGIN);
                                                } else {
                                                    onChange({ ...el, language: newLang, code: newCode }, true);
                                                }
                                            } else {
                                                onChange({ ...el, language: newLang }, true);
                                            }
                                        }}
                                        onPointerDown={(e) => e.stopPropagation()}
                                    >
                                        <option value="javascript">JavaScript</option>
                                        <option value="python">Python</option>
                                        <option value="java">Java</option>
                                        <option value="cpp">C++</option>
                                        <option value="go">Go</option>
                                        <option value="rust">Rust</option>
                                    </select>

                                    <button
                                        className="bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] border-none flex items-center justify-center rounded cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Reset to boilerplate"
                                        onPointerDown={(e) => e.stopPropagation()}
                                        disabled={isViewer}
                                        onClick={() => {
                                            const boilerplates = {
                                                javascript: "console.log('Hello from JS!');",
                                                python: "print('Hello from Python!')",
                                                java: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello from Java!\");\n    }\n}",
                                                cpp: "#include <iostream>\n\nint main() {\n    std::cout << \"Hello from C++!\" << std::endl;\n    return 0;\n}",
                                                go: "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello from Go!\")\n}",
                                                rust: "fn main() {\n    println!(\"Hello from Rust!\");\n}"
                                            };
                                            const newCode = boilerplates[el.language];

                                            // Synchronize both metadata and shared text buffer
                                            const shared = boardStore.getContent(el.id);
                                            if (shared) {
                                                boardStore.transact(() => {
                                                    shared.delete(0, shared.length);
                                                    shared.insert(0, newCode);
                                                    onChange({ ...el, code: newCode }, true);
                                                }, BOARD_RESET_ORIGIN);
                                            } else {
                                                onChange({ ...el, code: newCode }, true);
                                            }
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
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={handleExecute}
                                    disabled={isRunning || isViewer}
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
                                <SharedCodeEditor
                                    id={el.id}
                                    boardStore={boardStore}
                                    el={el}
                                    onChange={onChange}
                                    isViewer={isViewer}
                                    camera={camera}
                                    sw={sw}
                                />
                            </div>

                            {/* Terminal Resizer / Top Edge */}
                            {isTerminalActive && (
                                <div
                                    className="h-1.5 w-full cursor-row-resize bg-transparent hover:bg-blue-500/30 transition-colors z-20 shrink-0"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        const startY = e.clientY;
                                        const startH = effectiveTerminalHeight;

                                        const handleMove = (moveEvent) => {
                                            const deltaY = startY - moveEvent.clientY;
                                            const newH = Math.max(80, Math.min(sh - 100, startH + deltaY));
                                            setLocalTerminalHeight(newH);
                                        };

                                        const handleUp = () => {
                                            window.removeEventListener("pointermove", handleMove);
                                            window.removeEventListener("pointerup", handleUp);
                                            // Persist height to Yjs on finish
                                            setLocalTerminalHeight((finalH) => {
                                                onChange({ ...el, terminalHeight: finalH }, true);
                                                return null; // Reset local state as prop will take over
                                            });
                                        };

                                        window.addEventListener("pointermove", handleMove);
                                        window.addEventListener("pointerup", handleUp);
                                    }}
                                />
                            )}

                            {/* Recorded Terminal Transcript */}
                            {shouldShowRecordedTerminal && (
                                <RecordedTerminal
                                    el={el}
                                    camera={camera}
                                    height={effectiveTerminalHeight}
                                    segments={terminalSegments}
                                />
                            )}

                            {/* Native Terminal Interface */}
                            {isTerminalActive && (
                                <div
                                    className="border-t border-[#313244] shrink-0"
                                    style={{ height: effectiveTerminalHeight }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    onKeyUp={(e) => e.stopPropagation()}
                                    onWheel={(e) => {
                                        if (e.ctrlKey || e.metaKey) return;
                                        e.stopPropagation();
                                    }}>
                                    <CodeTerminal
                                        key={`${el.id}-${terminalSessionKey}`}
                                        code={codeToRun || el.code}
                                        language={el.language}
                                        onStop={() => {
                                            setIsTerminalActive(false);
                                            onChange({ id: el.id, terminalActive: false }, true);
                                        }}
                                        isViewer={isViewer}
                                        camera={camera}
                                        terminalSessionKey={terminalSessionKey}
                                        onTranscriptChange={(terminalState) => {
                                            const terminalTranscript = typeof terminalState === "string"
                                                ? terminalState
                                                : terminalState?.transcript || "";
                                            const terminalScreen = typeof terminalState === "object"
                                                ? terminalState?.screen || ""
                                                : "";
                                            const terminalEvents = typeof terminalState === "object"
                                                ? terminalState?.events || []
                                                : [];
                                            const terminalInputDraft = typeof terminalState === "object"
                                                ? terminalState?.inputDraft || ""
                                                : "";
                                            onChange({
                                                id: el.id,
                                                code: codeToRun || el.code,
                                                terminalTranscript,
                                                terminalScreen,
                                                terminalEvents,
                                                terminalInputDraft,
                                                terminalActive: true,
                                            }, true);
                                        }}
                                    />
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
                                            readOnly={isViewer}
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
                                            onPointerDown={(e) => e.stopPropagation()}
                                        />
                                        <p style={{ fontSize: 11 * camera.z, color: '#6c7086' }}>
                                            Supports youtube.com and youtu.be links
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : el.type === "graph" ? (
                        <GraphElement
                            element={el}
                            onChange={onChange}
                            isDark={isDarkMode}
                            isSelected={isSelected}
                            sw={sw}
                            sh={sh}
                            camera={camera}
                            isViewer={isViewer}
                            onOpenSidebar={onOpenSidebar}
                            onStartEdit={() => onStartEdit(el.id)}
                            sidebarElementId={sidebarElementId}
                            onSidebarElementIdChange={onSidebarElementIdChange}
                            isSidebarOpen={isSidebarOpen}
                        />
                    ) : el.type === "path" ? (
                        <PathSVG el={el} sw={sw} sh={sh} />
                    ) : el.type === "image" ? (
                        <ImageBlock el={el} sw={sw} sh={sh} camera={camera} />
                    ) : (
                        <>
                            {/* Visual Background Layer */}
                            {el.type === "mermaid" ? (
                                <div className="absolute inset-0">
                                    <div className="absolute inset-0" style={{ zIndex: 0 }}>
                                        <MermaidRenderer code={el.text} isDark={isDarkMode} />
                                    </div>
                                    {isEditing && (
                                        <SharedMermaidEditor
                                            id={el.id}
                                            boardStore={boardStore}
                                            el={el}
                                            onChange={onChange}
                                            onEndEdit={onEndEdit}
                                            isViewer={isViewer}
                                            camera={camera}
                                            sw={sw}
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="absolute inset-0" style={{ zIndex: 0 }}>
                                    <ShapeSVG type={el.type} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} w={sw} h={sh} />
                                </div>
                            )}
                                {el.type === "sticky" && (
                                    <div
                                        className="absolute inset-0 rounded-[8px]"
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
                                        <svg width="24" height="24" className="absolute bottom-0 right-0 opacity-20" style={{ transform: "scale(0.8)", transformOrigin: "bottom right" }}>
                                            <path d="M 0 24 L 24 24 L 24 0 Z" fill="black" opacity="0.1" />
                                            <path d="M 0 24 L 24 0 L 0 0 Z" fill="white" opacity="0.2" />
                                        </svg>
                                    </div>
                                )}

                            {/* Text Foreground Layer */}
                            {el.type !== "mermaid" && (
                                <div style={{
                                    position: "absolute", inset: 0,
                                    padding: "12px",
                                    display: "flex", flexDirection: "column",
                                    justifyContent: valignMap[el.textVerticalAlign || (el.type === "text" ? "top" : "middle")] || "flex-start",
                                    zIndex: 1,
                                    pointerEvents: isEditing ? "auto" : "none",
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
                                            color: el.textColor || el.color || "#1e1e1e",
                                            textAlign: el.textAlign || (el.type === "text" ? "left" : "center"),
                                            whiteSpace: "pre-wrap", wordBreak: "break-word",
                                            outline: "none", lineHeight: 1.4,
                                            minHeight: "1em",
                                        }}
                                        dangerouslySetInnerHTML={isEditing ? undefined : { __html: (el.text || "").replace(/\n/g, "<br>") }}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </>
            ) : null}

            {/* Selection UI */}
            {isSelected && !isEditing && (
                <div className="absolute inset-0 rounded-[10px] pointer-events-auto" style={{ border: isMultiSelected ? "1.5px solid #2563eb" : (el.type === "text" ? "1.5px dashed #2563eb" : "2px solid #2563eb"), zIndex: 3, backgroundColor: "rgba(0,0,0,0)" }} />
            )}
            {isEditing && el.type === "text" && (
                <div className="absolute inset-0 rounded-sm pointer-events-none" style={{ border: "1.5px dashed #94a3b8", zIndex: 3 }} />
            )}
            {/* Only show individual resize/rotate handles when NOT multi-selected */}
            {isSelected && !isEditing && !isMultiSelected && !isViewer && el.type !== "arrow" && el.type !== "line" && handles.map(h => (
                <div key={h.id} onPointerDown={(e) => { e.stopPropagation(); handleResizeStart(e, h.id); }}
                    className="ui-container"
                    style={{ position: "absolute", width: 9, height: 9, background: "#fff", border: "2px solid #2563eb", borderRadius: 2, cursor: h.cursor, zIndex: 4, ...h, pointerEvents: "auto" }} />
            ))}
            {isSelected && !isEditing && !isMultiSelected && !isViewer && el.type !== "arrow" && el.type !== "line" && (
                <div onPointerDown={(e) => { e.stopPropagation(); handleRotateStart(e); }} title="Rotate"
                    className="ui-container"
                    style={{ position: "absolute", top: -30, left: "calc(50% - 8px)", width: 16, height: 16, borderRadius: "50%", background: "#2563eb", cursor: "grab", zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto" }}>
                    <RotateCcw size={10} color="#fff" />
                </div>
            )}

            {/* Custom Arrow/Line Endpoint Handles */}
            {isSelected && !isEditing && !isMultiSelected && !isViewer && (el.type === "arrow" || el.type === "line") && (
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

export const MemoizedBoardElement = React.memo(BoardElement);
export default BoardElement;
