import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import { getUser, isLoggedIn } from "../lib/auth";
import api from "../lib/api";
import { io } from "socket.io-client";

function WhiteboardPage() {
  const navigate = useNavigate();
  const { id, boardId } = useParams();

  const me = getUser(); // { id, name, email }
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const socketRef = useRef(null);

  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const segmentsRef = useRef([]);
  const [statusMsg, setStatusMsg] = useState("");

  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(2);
  const [tool, setTool] = useState("pen"); // "pen" | "eraser"

  const [cursors, setCursors] = useState({});
  const lastCursorEmitRef = useRef(0);

  useEffect(() => {
    if (!isLoggedIn()) navigate("/login");
  }, [navigate]);

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

  const loadBoard = async () => {
    if (!token) return;

    setStatusMsg("Loading board...");
    try {
      const res = await api.get(`/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const segments = Array.isArray(res.data.segments) ? res.data.segments : [];
      segmentsRef.current = segments;

      redrawAll();
      setStatusMsg("");
    } catch (e) {
      setStatusMsg(e?.response?.data?.message || "Failed to load board.");
    }
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // ✅ IMPORTANT: backend socket requires JWT auth
    const socket = io("http://localhost:5001", {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 300,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinBoard", {
        boardId,
        user: { name: me?.name || "User" },
      });
    });

    socket.on("draw", (segment) => {
      segmentsRef.current.push(segment);
      drawSegment(segment);
    });

    socket.on("saved", () => {
      setStatusMsg("Autosaved ✅");
      setTimeout(() => setStatusMsg(""), 700);
    });

    socket.on("cleared", () => {
      segmentsRef.current = [];
      redrawAll();
      setStatusMsg("Cleared ✅");
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

    loadBoard();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      socket.emit("cursorLeave");
      socket.off("connect");
      socket.off("draw");
      socket.off("saved");
      socket.off("cleared");
      socket.off("cursorJoin");
      socket.off("cursorMove");
      socket.off("cursorLeave");
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const emitCursorMove = (x, y) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    const now = Date.now();
    if (now - lastCursorEmitRef.current < 30) return; // throttle
    lastCursorEmitRef.current = now;

    socket.emit("cursorMove", { boardId, x, y });
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const p = getCanvasPoint(e);
    drawingRef.current = true;
    lastPointRef.current = p;
    emitCursorMove(p.x, p.y);
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    const p = getCanvasPoint(e);
    emitCursorMove(p.x, p.y);

    if (!drawingRef.current) return;

    const prev = lastPointRef.current;

    const effectiveColor = tool === "eraser" ? "#ffffff" : color;
    const effectiveWidth = tool === "eraser" ? Math.max(10, width * 3) : width;

    const segment = {
      x0: prev.x,
      y0: prev.y,
      x1: p.x,
      y1: p.y,
      color: effectiveColor,
      width: effectiveWidth,
    };

    segmentsRef.current.push(segment);
    drawSegment(segment);

    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit("draw", { boardId, segment });
    }

    lastPointRef.current = p;
  };

  const onPointerUp = (e) => {
    e.preventDefault();
    drawingRef.current = false;
  };

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
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    if (!window.confirm("Clear the board for everyone?")) return;
    socket.emit("clearBoard", { boardId });
  };

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        const copy = { ...prev };
        for (const [uid, c] of Object.entries(copy)) {
          if (now - (c.ts || 0) > 8000) delete copy[uid];
        }
        return copy;
      });
    }, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold">Whiteboard</h1>
              <p className="text-sm text-neutral-500">
                Live drawing + autosave + live cursors.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate(`/workspaces/${id}/boards`)}
              >
                Back to boards
              </button>
            </div>
          </div>

          <div className="card bg-base-100 shadow-md mb-4">
            <div className="card-body flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="join">
                  <button
                    className={`btn btn-sm join-item ${tool === "pen" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setTool("pen")}
                    type="button"
                  >
                    Pen
                  </button>
                  <button
                    className={`btn btn-sm join-item ${tool === "eraser" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setTool("eraser")}
                    type="button"
                  >
                    Eraser
                  </button>
                </div>

                <label className="text-sm">
                  Color{" "}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="ml-2 align-middle"
                    disabled={tool === "eraser"}
                  />
                </label>

                <label className="text-sm">
                  Width{" "}
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="ml-2 align-middle"
                  />
                  <span className="ml-2 text-xs text-neutral-500">{width}</span>
                </label>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button className="btn btn-ghost btn-sm" onClick={handleCopyLink}>
                  Copy link
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleClearBoard}>
                  Clear
                </button>
                {statusMsg && <span className="text-sm text-neutral-500 ml-2">{statusMsg}</span>}
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <div className="w-full relative">
                <canvas
                  ref={canvasRef}
                  className="w-full border border-base-300 rounded-md touch-none bg-white"
                  onMouseDown={onPointerDown}
                  onMouseMove={onPointerMove}
                  onMouseUp={onPointerUp}
                  onMouseLeave={onPointerUp}
                  onTouchStart={onPointerDown}
                  onTouchMove={onPointerMove}
                  onTouchEnd={onPointerUp}
                />

                {/* live cursors overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {Object.entries(cursors).map(([userId, c]) => (
                    <div
                      key={userId}
                      style={{
                        position: "absolute",
                        left: c.x,
                        top: c.y,
                        transform: "translate(8px, 8px)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: c.color,
                            display: "inline-block",
                            border: "2px solid white",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            padding: "2px 6px",
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.9)",
                            border: `1px solid ${c.color}`,
                            color: "#111827",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-neutral-500 mt-3">
                Tip: cursors show while users move on the board.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default WhiteboardPage;
