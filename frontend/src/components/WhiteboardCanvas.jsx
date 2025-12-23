import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client"; // Helper if we need types, but JS is fine

export default function WhiteboardCanvas({ 
  boardId, 
  socket, 
  initialSegments, 
  me 
}) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  
  // Local State for Tools (Controls)
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(2);
  const [statusMsg, setStatusMsg] = useState("");

  // Canvas State
  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const segmentsRef = useRef([]);
  const [cursors, setCursors] = useState({});
  const lastCursorEmitRef = useRef(0);

  // --- INITIALIZE SEGMENTS FROM PARENT ---
  useEffect(() => {
    if (initialSegments && initialSegments.length > 0) {
      segmentsRef.current = initialSegments;
      redrawAll();
    }
  }, [initialSegments]);

  // --- CANVAS HELPERS ---
  const fillWhiteBackground = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  const drawSegment = (seg) => {
    const ctx = ctxRef.current;
    if (!ctx || !seg) return;
    ctx.strokeStyle = seg.color || "#000000";
    ctx.lineWidth = seg.width || 2;
    ctx.beginPath();
    ctx.moveTo(seg.x0, seg.y0);
    ctx.lineTo(seg.x1, seg.y1);
    ctx.stroke();
  };

  const redrawAll = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fillWhiteBackground();
    for (const seg of segmentsRef.current) drawSegment(seg);
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const w = parent ? parent.clientWidth : 900;
    const h = 520;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
    redrawAll();
  };

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    if (socket) {
      socket.on("draw", (segment) => {
        segmentsRef.current.push(segment);
        drawSegment(segment);
      });

      socket.on("cleared", () => {
        segmentsRef.current = [];
        redrawAll();
        setStatusMsg("Cleared ✅");
        setTimeout(() => setStatusMsg(""), 700);
      });

      socket.on("saved", () => {
        setStatusMsg("Autosaved ✅");
        setTimeout(() => setStatusMsg(""), 700);
      });

      socket.on("cursorJoin", ({ userId, name, color }) => {
        setCursors((prev) => ({
          ...prev,
          [userId]: prev[userId] || { name, color, x: 0, y: 0, ts: Date.now() },
        }));
      });

      socket.on("cursorMove", ({ userId, name, color, x, y }) => {
        setCursors((prev) => ({
          ...prev,
          [userId]: { name, color, x, y, ts: Date.now() },
        }));
      });

      socket.on("cursorLeave", ({ userId }) => {
        setCursors((prev) => {
          const copy = { ...prev };
          delete copy[userId];
          return copy;
        });
      });
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (socket) {
        socket.off("draw");
        socket.off("cleared");
        socket.off("saved");
        socket.off("cursorJoin");
        socket.off("cursorMove");
        socket.off("cursorLeave");
      }
    };
  }, [socket]);

  // Cleanup old cursors
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        const copy = { ...prev };
        let changed = false;
        for (const [uid, c] of Object.entries(copy)) {
          if (now - (c.ts || 0) > 8000) {
            delete copy[uid];
            changed = true;
          }
        }
        return changed ? copy : prev;
      });
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // --- POINTER EVENTS ---
  const emitCursorMove = (x, y) => {
    if (!socket || !socket.connected) return;
    const now = Date.now();
    if (now - lastCursorEmitRef.current < 30) return; 
    lastCursorEmitRef.current = now;
    socket.emit("cursorMove", { boardId, x, y });
  };

  const onPointerDown = (e) => {
    const p = getCanvasPoint(e);
    drawingRef.current = true;
    lastPointRef.current = p;
    emitCursorMove(p.x, p.y);
  };

  const onPointerMove = (e) => {
    const p = getCanvasPoint(e);
    emitCursorMove(p.x, p.y);
    if (!drawingRef.current) return;
    
    const prev = lastPointRef.current;
    const effectiveColor = tool === "eraser" ? "#ffffff" : color;
    const effectiveWidth = tool === "eraser" ? Math.max(10, width * 3) : width;
    
    const segment = {
      x0: prev.x, y0: prev.y,
      x1: p.x, y1: p.y,
      color: effectiveColor,
      width: effectiveWidth,
    };
    
    segmentsRef.current.push(segment);
    drawSegment(segment);
    
    if (socket?.connected) {
      socket.emit("draw", { boardId, segment });
    }
    lastPointRef.current = p;
  };

  const onPointerUp = () => {
    drawingRef.current = false;
  };

  // --- HANDLERS ---
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatusMsg("Link copied ✅");
      setTimeout(() => setStatusMsg(""), 700);
    } catch {
      setStatusMsg("Could not copy link.");
    }
  };

  const handleClearBoard = () => {
    if (!socket?.connected) return;
    if (!window.confirm("Clear the board for everyone?")) return;
    socket.emit("clearBoard", { boardId });
  };

  return (
    <>
      {/* Controls Card */}
      <div className="card bg-base-100 shadow-md mb-4">
        <div className="card-body flex flex-col gap-3 md:flex-row md:items-center md:justify-between py-3 px-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="join">
              <button
                className={`btn btn-sm join-item ${tool === "pen" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setTool("pen")}
              >
                Pen
              </button>
              <button
                className={`btn btn-sm join-item ${tool === "eraser" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setTool("eraser")}
              >
                Eraser
              </button>
            </div>

            <label className="text-sm flex items-center gap-2">
              Color 
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                disabled={tool === "eraser"}
              />
            </label>

            <label className="text-sm flex items-center gap-2">
              Width 
              <input
                type="range"
                min="1" max="10"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="range range-xs range-primary w-24"
              />
              <span className="text-xs text-neutral-500 w-4">{width}</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={handleCopyLink}>Copy link</button>
            <button className="btn btn-ghost btn-sm text-error" onClick={handleClearBoard}>Clear</button>
            {statusMsg && <span className="text-sm text-neutral-500 ml-2">{statusMsg}</span>}
          </div>
        </div>
      </div>

      {/* Canvas Card */}
      <div className="card bg-base-100 shadow-md mb-8">
        <div className="card-body p-1 relative">
          <canvas
            ref={canvasRef}
            className="w-full border border-base-200 rounded-md touch-none bg-white cursor-crosshair"
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
          />
          {/* Cursors Overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Object.entries(cursors).map(([userId, c]) => (
              <div
                key={userId}
                style={{
                  position: "absolute",
                  left: c.x, top: c.y,
                  transform: "translate(2px, 2px)",
                  transition: "all 0.1s linear"
                }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full border border-white"
                    style={{ background: c.color }}
                  />
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/90 border shadow-sm whitespace-nowrap"
                    style={{ borderColor: c.color, color: "#333" }}
                  >
                    {c.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}