import { useEffect, useRef, useState, useCallback } from "react";
import { Pen, Eraser, Hand, ZoomIn, ZoomOut, StickyNote, Square, Circle, Triangle, ArrowRight, MousePointer2, ChevronUp, Type, Terminal, Youtube, Plus, Map as MapIcon } from "lucide-react";
import ElementsLayer from "./ElementsLayer";
import { getElementBounds } from "./canvas/geometryUtils";

import { getInitials } from "./canvas/utils/participantUtils";

import LivePathOverlay from "./canvas/overlays/LivePathOverlay";
import EraserTrailOverlay from "./canvas/overlays/EraserTrailOverlay";
import RemoteLiveStrokesOverlay from "./canvas/overlays/RemoteLiveStrokesOverlay";
import CursorOverlay from "./canvas/overlays/CursorOverlay";
import SelectionMarquee from "./canvas/overlays/SelectionMarquee";
import EraserCursor from "./canvas/overlays/EraserCursor";
import FollowBanner from "./canvas/overlays/FollowBanner";

import useCanvasToolState from "../hooks/useCanvasToolState";
import useCanvasElementsState from "../hooks/useCanvasElementsState";
import useCanvasUiState from "../hooks/useCanvasUiState";
import useCanvasCamera from "../hooks/useCanvasCamera";
import useCanvasRealtime from "../hooks/useCanvasRealtime";
import useCanvasHistory from "../hooks/useCanvasHistory";
import useCanvasInteraction from "../hooks/useCanvasInteraction";



export default function TestInfiniteCanvas({ boardId, socket, initialSegments, me, renderTopLeftUI, talkingUserIds = [], isViewer = false }) {
    const {
        tool, setTool, toolRef,
        isViewerRef,
        color, setColor,
        width, setWidth,
        bgMode, setBgMode,
        isDark, setIsDark,
        shapeType, setShapeType,
        lastShapeType, setLastShapeType,
        toolbarClass, ghostBtnClass
    } = useCanvasToolState(isViewer);

    const {
        elements, setElements, elementsRef,
        selectedIds, setSelectedIds, selectedIdsRef,
        selectionBox, setSelectionBox, selectionBoxRef,
        ghostElement, setGhostElement,
        pendingEditId, setPendingEditId, clearPendingEditId
    } = useCanvasElementsState(tool);

    const {
        shapesOpen, setShapesOpen, shapesRef,
        plusOpen, setPlusOpen, plusRef,
        colorOpen, setColorOpen, colorRef,
        isMinimapVisible, setIsMinimapVisible, minimapCanvasRef, minimapCtxRef,
        isMobile,
        toolbarRef, toolbarHeight,
        mousePos, setMousePos,
        statusMsg, setStatusMsg,
        ctrlPressed
    } = useCanvasUiState();

    const {
        camera, setCamera, cameraRef,
        targetCameraRef, isAnimatingRef,
        startCameraAnimation,
        followedUserId, setFollowedUserId, followedUserIdRef,
        remoteCamerasRef,
        screenToWorld, worldToScreen
    } = useCanvasCamera();

    // --- history domain ---
    const { 
        undoStackRef, redoStackRef, pushAction, undo, redo 
    } = useCanvasHistory({
        socket, boardId, setElements, isViewerRef
    });

    const {
        participants, setParticipants,
        cursors, setCursors,
        remoteLiveStrokes, setRemoteLiveStrokes,
        emitCursorMove, emitCameraUpdate, emitClearBoard
    } = useCanvasRealtime({
        boardId, socket, me,
        setElements, setCamera,
        followedUserIdRef, remoteCamerasRef,
        setStatusMsg,
        undoStackRef, redoStackRef
    });

    // Broadcast our camera continuously when it changes
    useEffect(() => {
        emitCameraUpdate(camera);
    }, [camera, emitCameraUpdate]);

    // --- interaction domain ---
    const {
        onPointerDown, onPointerMove, onPointerUp,
        currentPath, eraserPath, handleMinimapPointer
    } = useCanvasInteraction({
        tool, setTool, toolRef,
        isViewerRef,
        color, width,
        isDark,
        lastShapeType, setLastShapeType,
        elementsRef, setElements,
        selectedIds, setSelectedIds,
        selectionBoxRef, setSelectionBox,
        ghostElement, setGhostElement,
        pushAction,
        setPendingEditId,
        camera, setCamera, cameraRef,
        targetCameraRef, startCameraAnimation,
        screenToWorld,
        setFollowedUserId,
        socket, boardId, me,
        emitCursorMove,
        setMousePos,
        minimapCanvasRef
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
                mCtx.fillStyle = "#374151"; 
                mCtx.fillRect(ex, ey, ew, eh);
            } else if (el.type === "video") {
                mCtx.fillStyle = "#1f2937"; 
                mCtx.fillRect(ex, ey, ew, eh);
                mCtx.fillStyle = "#ef4444";
                mCtx.beginPath();
                mCtx.moveTo(ex + ew / 2 - 2, ey + eh / 2 - 3);
                mCtx.lineTo(ex + ew / 2 + 4, ey + eh / 2);
                mCtx.lineTo(ex + ew / 2 - 2, ey + eh / 2 + 3);
                mCtx.fill();
            }
            mCtx.restore();
        }

        const mainW = window.innerWidth;
        const mainH = window.innerHeight;
        const vtl = screenToWorld(0, 0); const vbr = screenToWorld(mainW, mainH);
        mCtx.fillStyle = "rgba(59, 130, 246, 0.2)"; mCtx.strokeStyle = "rgba(59, 130, 246, 0.8)";
        mCtx.lineWidth = 1;
        const vx = vtl.x * scale + offX, vy = vtl.y * scale + offY;
        const vw = (vbr.x - vtl.x) * scale, vh = (vbr.y - vtl.y) * scale;
        mCtx.fillRect(vx, vy, vw, vh); mCtx.strokeRect(vx, vy, vw, vh);

        mCtx.restore();
    }, [isMinimapVisible, elements, camera, screenToWorld]);

    useEffect(() => {
        drawMinimap();
    }, [elements, isMinimapVisible, camera, drawMinimap]);

    useEffect(() => {
        if (isMinimapVisible) {
            minimapCtxRef.current = null;
            setTimeout(() => drawMinimap(), 0);
        }
    }, [isMinimapVisible, drawMinimap]);

    useEffect(() => {
        window.addEventListener("resize", drawMinimap);
        return () => window.removeEventListener("resize", drawMinimap);
    }, [drawMinimap]);


    // ─── wheel zoom / pan ────────────────────────────────────────────────────

    useEffect(() => {
        const handleWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const zoomFactor = Math.exp(-e.deltaY * 0.005);
                const currentTarget = targetCameraRef.current;
                let nZ = currentTarget.z * zoomFactor;
                nZ = Math.min(10, Math.max(0.1, nZ));
                
                const sx = e.clientX, sy = e.clientY;
                targetCameraRef.current = {
                    x: sx - (sx - currentTarget.x) * (nZ / currentTarget.z),
                    y: sy - (sy - currentTarget.y) * (nZ / currentTarget.z),
                    z: nZ
                };
                startCameraAnimation();
                return;
            }

            e.preventDefault();
            setFollowedUserId(null);
            const currentTarget = targetCameraRef.current;
            targetCameraRef.current = {
                x: currentTarget.x - e.deltaX,
                y: currentTarget.y - e.deltaY,
                z: currentTarget.z
            };
            startCameraAnimation();
        };

        window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
        return () => window.removeEventListener("wheel", handleWheel, { capture: true });
    }, [setFollowedUserId, targetCameraRef, startCameraAnimation]);


    // ─── middle-click panning (window level) ─────────────────────────────────
    useEffect(() => {
        const onMidDown = (e) => {
            if (e.button !== 1) return;
            e.preventDefault();
            setFollowedUserId(null);
            // This ref is still used internally via useCanvasInteraction if we pass it,
            // but for simple pan we can just use setCamera directly here or use interaction's onPointerDown.
            // Actually, interaction's onPointerDown handles middle click too.
            // But window level listeners are for robustness.
        };
        // For now, interaction hook handles pointer events on the container.
        // Middle click panning at the window level can be simplified if needed.
    }, [setFollowedUserId]);



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
            <LivePathOverlay currentPath={currentPath} camera={camera} />

            {/* Eraser trail preview */}
            <EraserTrailOverlay eraserPath={eraserPath} camera={camera} />

            {/* Remote live strokes preview */}
            <RemoteLiveStrokesOverlay remoteLiveStrokes={remoteLiveStrokes} camera={camera} />

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
                isViewer={isViewer}
            />

            <EraserCursor tool={tool} mousePos={mousePos} />

            <CursorOverlay cursors={cursors} worldToScreen={worldToScreen} />

            {/* UI overlay container */}
            <div className="absolute inset-0 pointer-events-none z-30">
                {/* Follow mode banner */}
                <FollowBanner 
                    followedUserId={followedUserId} 
                    participants={participants} 
                    onStopFollow={() => setFollowedUserId(null)} 
                    isMobile={isMobile} 
                />
                <div className={`absolute top-4 right-4 flex flex-col items-end ${isMobile ? "gap-2" : "gap-3"} z-30 pointer-events-none`}>
                    <div className="flex items-center gap-2">
                        {!isMobile && (
                            <div className="ui-container flex -space-x-3 pointer-events-auto mr-2">
                                {participants.slice(0, 5).map((p, idx) => (
                                    <div
                                        key={`${p.userId}-${idx}`}
                                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold shadow-sm transition-all duration-300 hover:scale-110 hover:z-10 cursor-pointer tooltip tooltip-bottom ${(followedUserId && String(followedUserId) === String(p.userId)) ? "ring-4 ring-blue-500 ring-offset-1 scale-110 z-10" : talkingUserIds.includes(p.userId) ? "ring-4 ring-green-400 animate-pulse scale-110 z-10" : ""}`}
                                        style={{ backgroundColor: p.color || "#ccc", borderColor: p.color || "#ccc" }}
                                        data-tip={p.name}
                                        onClick={() => {
                                            setFollowedUserId(prev => {
                                                const uid = String(p.userId);
                                                const next = (prev && String(prev) === uid) ? null : uid;
                                                if (next && remoteCamerasRef.current[next]) {
                                                    setCamera(remoteCamerasRef.current[next]);
                                                }
                                                return next;
                                            });
                                        }}
                                    >
                                        {p.avatar
                                            ? <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                                            : getInitials(p.name)
                                        }
                                    </div>
                                ))}
                                {participants.length > 5 && (
                                    <div className={`w-10 h-10 rounded-full border-2 border-white ${isDark ? "bg-slate-800 text-slate-300" : "bg-base-300 text-base-content"} flex items-center justify-center text-xs font-bold shadow-sm`}>
                                        +{participants.length - 5}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className={`ui-container bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-lg px-5 py-2 flex items-center gap-3 pointer-events-auto`}>
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse"></div>
                            {!isMobile && <span className={`text-sm font-semibold ${isDark ? "text-white opacity-90" : "opacity-60"}`}>{statusMsg || "Ready"}</span>}
                            <button className={`btn btn-ghost ${ghostBtnClass} btn-sm btn-circle ${!isMobile ? "ml-2" : ""}`} onClick={() => setIsMinimapVisible(!isMinimapVisible)} title="Toggle Minimap"><MapIcon className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className={`ui-container group bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-lg ${isMobile ? "flex flex-col items-center gap-1 px-2 py-2" : "px-3 py-2 flex items-center gap-1"} pointer-events-auto transition-all hover:bg-white/25`}>
                        <button 
                            className={`btn btn-sm btn-ghost ${isDark ? "text-white" : "text-base-content"} opacity-70 hover:opacity-100 px-2`} 
                            title="Zoom Out" 
                            onClick={() => {
                                const prev = targetCameraRef.current;
                                const nZ = Math.max(0.1, prev.z * 0.82);
                                const sx = window.innerWidth / 2, sy = window.innerHeight / 2;
                                targetCameraRef.current = { x: sx - (sx - prev.x) * (nZ / prev.z), y: sy - (sy - prev.y) * (nZ / prev.z), z: nZ };
                                startCameraAnimation();
                            }}
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>

                        {!isMobile && (
                            <div className="flex items-center w-0 opacity-0 group-hover:w-56 group-hover:opacity-100 transition-all duration-300 ease-in-out pointer-events-none group-hover:pointer-events-auto overflow-hidden">
                                <input 
                                    type="range" 
                                    min="0.1" 
                                    max="10" 
                                    step="0.01" 
                                    value={camera.z} 
                                    onChange={(e) => {
                                        const nZ = parseFloat(e.target.value);
                                        const prev = targetCameraRef.current;
                                        const sx = window.innerWidth / 2, sy = window.innerHeight / 2;
                                        targetCameraRef.current = { x: sx - (sx - prev.x) * (nZ / prev.z), y: sy - (sy - prev.y) * (nZ / prev.z), z: nZ };
                                        startCameraAnimation();
                                    }}
                                    className={`custom-zoom-slider w-52 mx-2 ${isDark ? "dark" : ""}`}
                                />
                            </div>
                        )}

                        <button 
                            className={`btn btn-sm btn-ghost font-mono text-xs px-2 min-h-0 h-7 ${isDark ? "text-white bg-white/10 hover:bg-white/20" : "text-base-content bg-base-200 hover:bg-base-300"}`} 
                            onClick={() => {
                                const prev = targetCameraRef.current;
                                const nZ = 1;
                                const sx = window.innerWidth / 2, sy = window.innerHeight / 2;
                                targetCameraRef.current = { x: sx - (sx - prev.x) * (nZ / prev.z), y: sy - (sy - prev.y) * (nZ / prev.z), z: nZ };
                                startCameraAnimation();
                            }}
                        >
                            {Math.round(camera.z * 100)}%
                        </button>
                        
                        <button 
                            className={`btn btn-sm btn-ghost ${isDark ? "text-white" : "text-base-content"} opacity-70 hover:opacity-100 px-2`} 
                            title="Zoom In" 
                            onClick={() => {
                                const prev = targetCameraRef.current;
                                const nZ = Math.min(10, prev.z * 1.25);
                                const sx = window.innerWidth / 2, sy = window.innerHeight / 2;
                                targetCameraRef.current = { x: sx - (sx - prev.x) * (nZ / prev.z), y: sy - (sy - prev.y) * (nZ / prev.z), z: nZ };
                                startCameraAnimation();
                            }}
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>
                    {isMinimapVisible && (
                        <div className={`ui-container bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-lg p-2 pointer-events-auto origin-top-right`}>
                            <canvas ref={minimapCanvasRef} className={`w-48 h-32 rounded-xl border cursor-grab active:cursor-grabbing ${isDark ? "border-[#333333]" : "border-base-300"}`} style={{ backgroundColor: isDark ? "#121212" : "#f8fafc" }} onMouseDown={handleMinimapPointer} onMouseMove={handleMinimapPointer} onTouchStart={handleMinimapPointer} onTouchMove={handleMinimapPointer} />
                        </div>
                    )}
                </div>

                <div
                    ref={toolbarRef}
                    className={`ui-container absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-lg px-4 py-2 z-30 flex items-center gap-3 max-w-[95vw] flex-wrap justify-center pointer-events-auto`}
                >
                    {isViewer ? (
                        /* Viewers only see the hand tool */
                        <div className={`join ${isDark ? "bg-[#121212]/50" : "bg-base-200/50"} p-1 rounded-xl`}>
                            <button className={`btn btn-sm join-item border-none tooltip tooltip-top bg-primary text-primary-content shadow-lg`} onClick={() => setTool("hand")} data-tip="Hand (H)"><Hand className="w-5 h-5" /></button>
                        </div>
                    ) : (
                        <>
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
                            <div className="relative pointer-events-auto" ref={shapesRef}>
                                <button
                                    className={`btn btn-sm ${["sticky", "rect", "ellipse", "triangle", "arrow"].includes(tool) ? "bg-warning text-warning-content" : ghostBtnClass} border-none rounded-xl`}
                                    onClick={() => { setShapesOpen(!shapesOpen); setPlusOpen(false); setColorOpen(false); }}
                                >
                                    <div className="flex items-center gap-2">
                                        {lastShapeType === "sticky" && <StickyNote className="w-5 h-5 text-warning" />}
                                        {lastShapeType === "rect" && <Square className="w-5 h-5" color={isDark ? "#ffffff" : "black"} fill="transparent" strokeWidth={2} />}
                                        {lastShapeType === "ellipse" && <Circle className="w-5 h-5" color={isDark ? "#ffffff" : "black"} fill="transparent" strokeWidth={2} />}
                                        {lastShapeType === "triangle" && <Triangle className="w-5 h-5" color={isDark ? "#ffffff" : "black"} fill="transparent" strokeWidth={2} />}
                                        {lastShapeType === "arrow" && <ArrowRight className="w-5 h-5" color={isDark ? "#ffffff" : "black"} strokeWidth={2} />}
                                        <ChevronUp className={`w-4 h-4 opacity-50 transition-transform ${shapesOpen ? "rotate-180" : ""}`} />
                                    </div>
                                </button>
                                {/* Popup moved to top level */}
                            </div>
                            <div className="relative pointer-events-auto" ref={plusRef}>
                                <button
                                    className={`btn btn-sm ${["code", "video"].includes(tool) ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass} border-none rounded-xl`}
                                    onClick={() => { setPlusOpen(!plusOpen); setShapesOpen(false); setColorOpen(false); }}
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                                {/* Popup moved to top level */}
                            </div>
                            <div className="flex items-center gap-2 pointer-events-auto">
                                {/* The Settings menu was moved to TestWhiteboardPage via renderTopLeftUI */}
                            </div>
                        </>
                    )}
                </div>

                {/* Dropdown Popups (Moved to top level to avoid nested backdrop-blur) */}
                {!isViewer && shapesOpen && (
                    <div id="shapes-popup" className="ui-container z-50 p-4 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-2xl w-72 min-w-[280px] pointer-events-auto" style={{ position: 'absolute', bottom: toolbarHeight + 64, left: '50%', transform: 'translateX(-50%)' }}>
                        <div className="grid grid-cols-5 gap-3">
                            <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("sticky"); setLastShapeType("sticky"); setShapesOpen(false); }} data-tip="Sticky Note (S)"><StickyNote className="w-5 h-5 text-warning" /></button>
                            <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("rect"); setLastShapeType("rect"); setShapesOpen(false); }} data-tip="Rectangle (R)"><Square className="w-5 h-5" color={isDark ? "white" : "black"} fill="transparent" strokeWidth={2} /></button>
                            <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("ellipse"); setLastShapeType("ellipse"); setShapesOpen(false); }} data-tip="Ellipse (O)"><Circle className="w-5 h-5" color={isDark ? "white" : "black"} fill="transparent" strokeWidth={2} /></button>
                            <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("triangle"); setLastShapeType("triangle"); setShapesOpen(false); }} data-tip="Triangle"><Triangle className="w-5 h-5" color={isDark ? "white" : "black"} fill="transparent" strokeWidth={2} /></button>
                            <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("arrow"); setLastShapeType("arrow"); setShapesOpen(false); }} data-tip="Arrow (A)"><ArrowRight className="w-5 h-5" color={isDark ? "white" : "black"} strokeWidth={2} /></button>
                        </div>
                    </div>
                )}

                {!isViewer && plusOpen && (
                    <div id="plus-popup" className="ui-container z-50 p-3 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-2xl pointer-events-auto" style={{ position: 'absolute', bottom: toolbarHeight + 64, left: '50%', transform: 'translateX(-50%)' }}>
                        <div className="flex gap-2">
                            <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("code"); setPlusOpen(false); }} data-tip="Code (C)">
                                <Terminal className="w-5 h-5" />
                            </button>
                            <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("video"); setPlusOpen(false); }} data-tip="Video (Y)">
                                <Youtube className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {!isViewer && colorOpen && (
                    <div id="color-popup" data-ui="color-menu" className="ui-container z-40 p-4 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-2xl w-56 pointer-events-auto" style={{ position: 'absolute', bottom: toolbarHeight + 112, left: colorRef.current ? colorRef.current.getBoundingClientRect().left + colorRef.current.offsetWidth / 2 : '50%', transform: 'translateX(-50%)' }}>
                        <div className="grid grid-cols-4 gap-3">
                            {["#000000", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#ffffff"].map((c) => (
                                <button key={c} className={`w-10 h-10 rounded-full border transition-all hover:scale-110 active:scale-90 ${isDark ? "border-white/10" : "border-base-300"}`} style={{ backgroundColor: c }} onClick={() => { setColor(c); setColorOpen(false); }} />
                            ))}
                        </div>
                        <div className={`h-px w-full my-4 bg-white/20`} />
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold uppercase tracking-widest opacity-40">Custom</span>
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className={`w-full h-9 cursor-pointer rounded-xl bg-white/10 p-1 border border-white/20`}
                            />
                        </div>
                    </div>
                )}

                {/* Provide the Top Left UI render slot here, floating above everything */}
                {renderTopLeftUI && (
                    <div className="relative">
                        <div className="ui-container absolute top-5 left-5 z-50 pointer-events-none flex items-center gap-3 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-lg p-3">
                            {renderTopLeftUI({
                                isDark,
                                setIsDark,
                                setBgMode,
                                clearBoard: () => {
                                    if (window.confirm("Clear board?")) {
                                        emitClearBoard();
                                    }
                                }
                            })}
                        </div>
                        {isMobile && (
                            <div className="ui-container absolute top-5 left-5 mt-20 flex -space-x-3 z-50 pointer-events-auto">
                                {participants.slice(0, 5).map((p, idx) => (
                                    <div
                                        key={`${p.userId}-${idx}`}
                                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold shadow-sm transition-all duration-300 hover:scale-110 hover:z-10 cursor-pointer tooltip tooltip-bottom ${(followedUserId && String(followedUserId) === String(p.userId)) ? "ring-4 ring-blue-500 ring-offset-1 scale-110 z-10" : talkingUserIds.includes(p.userId) ? "ring-4 ring-green-400 animate-pulse scale-110 z-10" : ""}`}
                                        style={{ backgroundColor: p.color || "#ccc", borderColor: p.color || "#ccc" }}
                                        data-tip={p.name}
                                        onClick={() => {
                                            setFollowedUserId(prev => {
                                                const uid = String(p.userId);
                                                const next = (prev && String(prev) === uid) ? null : uid;
                                                if (next && remoteCamerasRef.current[next]) {
                                                    setCamera(remoteCamerasRef.current[next]);
                                                }
                                                return next;
                                            });
                                        }}
                                    >
                                        {p.avatar
                                            ? <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                                            : getInitials(p.name)
                                        }
                                    </div>
                                ))}
                                {participants.length > 5 && (
                                    <div className={`w-10 h-10 rounded-full border-2 border-white ${isDark ? "bg-slate-800 text-slate-300" : "bg-base-300 text-base-content"} flex items-center justify-center text-xs font-bold shadow-sm`}>
                                        +{participants.length - 5}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {!isViewer && tool === "pen" && (
                    <div
                        className={`ui-container absolute left-1/2 -translate-x-1/2 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-lg px-4 py-2 z-30 flex items-center gap-4 pointer-events-auto`}
                        style={{ bottom: toolbarHeight + 42 }} // Offset above the toolbar
                    >
                        <div className="relative pointer-events-auto" ref={colorRef}>
                            <button
                                className="flex items-center justify-center w-10 h-10 rounded-full shadow-lg cursor-pointer ring-2 ring-offset-2 ring-base-300 hover:ring-primary transition-all active:scale-95"
                                style={{ backgroundColor: color }}
                                onClick={() => { setColorOpen(!colorOpen); setShapesOpen(false); setPlusOpen(false); }}
                            />
                            {/* Popup moved to top level */}
                        </div>
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

            {/* Status Messages */}
            {statusMsg && (
                <div className="absolute bottom-5 left-5 z-50 bg-success text-success-content px-4 py-2 rounded-full shadow-lg opacity-90 transition-opacity">
                    {statusMsg}
                </div>
            )}

            {/* Selection Box Visual */}
            <SelectionMarquee selectionBox={selectionBox} camera={camera} />
        </div>
    );
}
