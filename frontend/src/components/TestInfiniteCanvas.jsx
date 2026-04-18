import { useEffect, useRef, useState, useCallback } from "react";
import ElementsLayer from "./ElementsLayer";
import { getElementBounds } from "./canvas/geometryUtils";

import EraserCursor from "./canvas/overlays/EraserCursor";
import FollowBanner from "./canvas/overlays/FollowBanner";
import BoardElement from "./canvas/BoardElement";

import CanvasToolbar from "./canvas/ui/CanvasToolbar";
import ShapeMenu from "./canvas/ui/ShapeMenu";
import InsertMenu from "./canvas/ui/InsertMenu";
import ColorPopup from "./canvas/ui/ColorPopup";
import PenControls from "./canvas/ui/PenControls";
import ParticipantsStrip from "./canvas/ui/ParticipantsStrip";
import MobileParticipantsStrip from "./canvas/ui/MobileParticipantsStrip";
import ZoomControls from "./canvas/ui/ZoomControls";
import Minimap from "./canvas/ui/Minimap";
import StatusBadge from "./canvas/ui/StatusBadge";
import PropertySidebar from "./canvas/ui/PropertySidebar";
import RecordButton from "./replay/RecordButton";

import useCanvasToolState from "../hooks/useCanvasToolState";
import useCanvasElementsState from "../hooks/useCanvasElementsState";
import useCanvasUiState from "../hooks/useCanvasUiState";
import useCanvasCamera from "../hooks/useCanvasCamera";
import useCanvasRealtime from "../hooks/useCanvasRealtime";
import useCanvasHistory from "../hooks/useCanvasHistory";
import useCanvasInteraction from "../hooks/useCanvasInteraction";
import useBoardRecording from "../hooks/useBoardRecording";
import useYjsBoard from "../hooks/useYjsBoard";
import { useCanvasRenderer } from "../canvas/useCanvasRenderer";



export default function TestInfiniteCanvas({ boardId, boardTitle = "Whiteboard Session", workspaceId, socket, initialSegments, me, renderTopLeftUI, talkingUserIds = [], isViewer = false }) {
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

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sidebarElementId, setSidebarElementId] = useState(null);

    const yjsToken = localStorage.getItem("token");

    // Canvas renderer
    const canvasRef = useRef(null);
    const { rendererRef, syncOverlays } = useCanvasRenderer(canvasRef);

    const {
        yElementsRef,
        yMetaRef,
        providerRef,
        yElements,
        connected: yjsConnected,
        synced: yjsSynced,
    } = useYjsBoard({
        boardId,
        token: yjsToken,
        enabled: !!boardId && !!yjsToken,
    });

    const {
        camera, setCamera, cameraRef,
        targetCameraRef, isAnimatingRef,
        startCameraAnimation,
        followedUserId, setFollowedUserId, followedUserIdRef,
        remoteCamerasRef,
        screenToWorld, worldToScreen
    } = useCanvasCamera();

    const {
        isRecording,
        recordingStatus,
        duration,
        startRecording,
        stopRecording,
        recordEvent
    } = useBoardRecording({
        boardId,
        workspaceId: workspaceId || "unknown",
        elements,
        camera,
        userId: me?._id || me?.id,
        isDark,
        bgMode
    });

    // --- history domain ---
    const { 
        undoStackRef, redoStackRef, pushAction, undo, redo 
    } = useCanvasHistory({
        socket, boardId, setElements, isViewerRef, recordEvent, yElements
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
        undoStackRef, redoStackRef,
        recordEvent,
        rendererRef,
        yElements
    });

    // Broadcast our camera continuously when it changes
    useEffect(() => {
        emitCameraUpdate(camera);
    }, [camera, emitCameraUpdate]);

    // --- interaction domain ---
    const {
        onPointerDown, onPointerMove, onPointerUp,
        currentPath, eraserPath, handleMinimapPointer,
        autoShapePreview
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
        minimapCanvasRef,
        recordEvent,
        rendererRef,
        yElements
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
            } else if (el.type === "graph") {
                mCtx.fillStyle = "#dbeafe"; // Light blue
                mCtx.strokeStyle = "#3b82f6"; // Blue
                mCtx.fillRect(ex, ey, ew, eh);
                mCtx.strokeRect(ex, ey, ew, eh);
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

    // ─── sync overlay state into canvas renderer ──────────────────────────
    useEffect(() => {
        syncOverlays({
            remoteLiveStrokes,
            cursors,
            eraserPath,
            selectionBox,
            currentPath,
            bgMode,
            isDark,
            myUserId: me?.userId || me?.id || null,
            autoShapePreview
        });
    }, [remoteLiveStrokes, cursors, eraserPath, selectionBox,
        currentPath, bgMode, isDark, me, syncOverlays, autoShapePreview]);

    // ─── sync camera into canvas renderer ─────────────────────────────────
    useEffect(() => {
        rendererRef.current?.setCamera(camera);
    }, [camera, rendererRef]);

    // ─── sync elements into canvas renderer ──────────────────────────────
    useEffect(() => {
        rendererRef.current?.setElements(elements);
    }, [elements, rendererRef]);


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
            className={`relative w-full h-full overflow-hidden select-none touch-none ${
                tool === "hand" ? "cursor-grab active:cursor-grabbing" : 
                tool === "eraser" ? "cursor-none" : 
                tool === "select" ? "cursor-default" :
                tool === "text" ? "cursor-text" :
                "cursor-crosshair"
            }`}
            style={{ backgroundColor: isDark ? "#121212" : "#F0F0F0" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={(e) => { 
                setMousePos({ x: -100, y: -100 }); 
                if (rendererRef.current) rendererRef.current.localCursor = null;
                onPointerUp(e); 
            }}
            onPointerCancel={(e) => {
                if (rendererRef.current) rendererRef.current.localCursor = null;
                onPointerUp(e);
            }}
        >
            {/* Main drawing canvas — 60fps rAF loop, no React re-renders */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0"
                style={{
                    width: '100%',
                    height: '100%',
                    touchAction: 'none',
                    zIndex: 5,
                    pointerEvents: 'none'
                }}
            />

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
                onOpenSidebar={setIsSidebarOpen}
                isSidebarOpen={isSidebarOpen}
                onSidebarElementIdChange={setSidebarElementId}
                sidebarElementId={sidebarElementId}
                recordEvent={recordEvent}
                yElements={yElements}
                rendererRef={rendererRef}
            />




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
                        <ParticipantsStrip 
                            participants={participants}
                            followedUserId={followedUserId}
                            setFollowedUserId={setFollowedUserId}
                            talkingUserIds={talkingUserIds}
                            remoteCamerasRef={remoteCamerasRef}
                            setCamera={setCamera}
                            isDark={isDark}
                            isMobile={isMobile}
                        />

                        <div
                            className="ui-container pointer-events-none flex items-center"
                            title={yjsSynced ? "Yjs synced" : yjsConnected ? "Yjs syncing..." : "Yjs disconnected"}
                            style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                background: yjsSynced ? "#22c55e" : yjsConnected ? "#eab308" : "#6b7280" }}
                        />
                        <StatusBadge 
                            statusMsg={statusMsg}
                            isMinimapVisible={isMinimapVisible}
                            setIsMinimapVisible={setIsMinimapVisible}
                            isDark={isDark}
                            isMobile={isMobile}
                            ghostBtnClass={ghostBtnClass}
                        />
                    </div>

                    <ZoomControls 
                        camera={camera}
                        targetCameraRef={targetCameraRef}
                        startCameraAnimation={startCameraAnimation}
                        isDark={isDark}
                        isMobile={isMobile}
                    />

                    <Minimap 
                        isMinimapVisible={isMinimapVisible}
                        minimapCanvasRef={minimapCanvasRef}
                        handleMinimapPointer={handleMinimapPointer}
                        isDark={isDark}
                        onSettingsClick={() => {
                            if (selectedItems.length === 1) {
                                setSidebarElementId(selectedItems[0].id);
                                setIsSidebarOpen(true);
                            }
                        }}
                    />
                </div>

                <CanvasToolbar 
                    isViewer={isViewer}
                    tool={tool}
                    setTool={setTool}
                    ghostBtnClass={ghostBtnClass}
                    isDark={isDark}
                    toolbarRef={toolbarRef}
                >
                    {!isViewer && (
                        <>
                            <ShapeMenu 
                                tool={tool}
                                setTool={setTool}
                                shapesOpen={shapesOpen}
                                setShapesOpen={setShapesOpen}
                                shapesRef={shapesRef}
                                lastShapeType={lastShapeType}
                                setLastShapeType={setLastShapeType}
                                isDark={isDark}
                                ghostBtnClass={ghostBtnClass}
                                toolbarHeight={toolbarHeight}
                            />
                            <InsertMenu 
                                tool={tool}
                                setTool={setTool}
                                plusOpen={plusOpen}
                                setPlusOpen={setPlusOpen}
                                plusRef={plusRef}
                                ghostBtnClass={ghostBtnClass}
                                toolbarHeight={toolbarHeight}
                            />
                        </>
                    )}
                </CanvasToolbar>

                {!isViewer && (
                    <>
                        {colorOpen && (
                            <ColorPopup 
                                color={color}
                                setColor={setColor}
                                setColorOpen={setColorOpen}
                                isDark={isDark}
                                toolbarHeight={toolbarHeight}
                                colorRef={colorRef}
                            />
                        )}

                        <PenControls 
                            tool={tool}
                            color={color}
                            colorRef={colorRef}
                            colorOpen={colorOpen}
                            setColorOpen={setColorOpen}
                            setShapesOpen={setShapesOpen}
                            setPlusOpen={setPlusOpen}
                            width={width}
                            setWidth={setWidth}
                            isDark={isDark}
                            toolbarHeight={toolbarHeight}
                        />
                    </>
                )}

                {renderTopLeftUI && (
                    <div className="ui-container absolute top-5 left-5 z-50 pointer-events-none flex items-center gap-3">
                        {!isViewer && (
                            <div className="flex items-center pointer-events-auto">
                                <RecordButton 
                                    isRecording={isRecording}
                                    status={recordingStatus}
                                    duration={duration}
                                    onStart={() => {
                                        const now = new Date();
                                        const dateStr = now.toLocaleDateString();
                                        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        const defaultTitle = `${boardTitle} - ${dateStr} ${timeStr}`;
                                        
                                        const title = window.prompt("Recording Title:", defaultTitle);
                                        if (title !== null) startRecording(title);
                                    }}
                                    onStop={stopRecording}
                                    isDark={isDark}
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-3 pointer-events-auto">
                            {renderTopLeftUI({
                                isDark,
                                setIsDark,
                                setBgMode,
                                clearBoard: () => {
                                    if (window.confirm("Clear board?")) {
                                        setElements([]);
                                        rendererRef.current?.setElements([]);
                                        emitClearBoard();
                                        recordEvent("board.cleared", null, {});
                                    }
                                }
                            })}
                        </div>
                        <MobileParticipantsStrip 
                            isMobile={isMobile}
                            participants={participants}
                            followedUserId={followedUserId}
                            setFollowedUserId={setFollowedUserId}
                            talkingUserIds={talkingUserIds}
                            remoteCamerasRef={remoteCamerasRef}
                            setCamera={setCamera}
                        />
                    </div>
                )}
            </div>

            {/* Status Messages removed as they are now in StatusBadge or could be kept as toast */}
            
            <PropertySidebar 
                isOpen={isSidebarOpen}
                setIsOpen={(val) => {
                    setIsSidebarOpen(val);
                    if (!val) setSidebarElementId(null);
                }}
                element={elements.find(el => el.id === sidebarElementId)}
                onChange={(updates) => {
                    const elId = sidebarElementId;
                    setElements(prev => prev.map(el => el.id === elId ? { ...el, ...updates } : el));
                    // Emit update to others
                    const updatedEl = elements.find(el => el.id === elId);
                    if (updatedEl && socket?.connected) {
                        socket.emit("updateElement", { boardId, element: { ...updatedEl, ...updates } });
                    }
                }}
                isDark={isDark}
                zoom={camera.z}
            />

            {/* Selection Box Visual — now drawn on canvas */}
        </div>
    );
}
