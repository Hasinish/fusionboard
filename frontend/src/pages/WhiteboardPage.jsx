import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { Edit2, Check } from "lucide-react";

import NavBar from "../components/NavBar";
import WhiteboardCanvas from "../components/WhiteboardCanvas";
import PersonalNotes from "../components/PersonalNotes";
import { getUser, isLoggedIn } from "../lib/auth";
import api from "../lib/api";

function WhiteboardPage() {
  const navigate = useNavigate();
  const { id, boardId } = useParams();
  const me = getUser();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // --- PARENT STATE ---
  const [boardTitle, setBoardTitle] = useState("Loading...");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  
  // Data State
  const [initialSegments, setInitialSegments] = useState([]);
  
  // Socket State
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn()) navigate("/login");
  }, [navigate]);

  // --- API ---
  const loadBoard = async () => {
    if (!token) return;
    setStatusMsg("Loading board...");
    try {
      const res = await api.get(`/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBoardTitle(res.data.title || "Untitled Board");
      // Pass the segments to the child canvas for initial render
      if (res.data.segments) {
        setInitialSegments(res.data.segments);
      }
      setStatusMsg("");
    } catch (e) {
      setStatusMsg("Failed to load board.");
    }
  };

  const handleTitleSave = async () => {
    if (!tempTitle.trim()) {
       setIsEditingTitle(false);
       return;
    }
    setBoardTitle(tempTitle);
    setIsEditingTitle(false);
    try {
       await api.patch(`/boards/${boardId}`, 
          { title: tempTitle },
          { headers: { Authorization: `Bearer ${token}` } }
       );
       setStatusMsg("Title updated ✅");
       setTimeout(() => setStatusMsg(""), 1500);
    } catch (e) {
       setStatusMsg("Failed to update title");
       loadBoard(); 
    }
  };

  // --- SOCKET ---
  useEffect(() => {
    const socket = io("http://localhost:5001", {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinBoard", {
        boardId,
        user: { name: me?.name || "User" },
      });
    });

    loadBoard();

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />

      <main className="flex-1 pb-10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                 <div className="flex items-center gap-2">
                    <input 
                       className="input input-sm input-bordered text-lg font-bold"
                       value={tempTitle}
                       onChange={(e) => setTempTitle(e.target.value)}
                       autoFocus
                       onKeyDown={(e) => {
                          if (e.key === "Enter") handleTitleSave();
                          if (e.key === "Escape") setIsEditingTitle(false);
                       }}
                    />
                    <button className="btn btn-sm btn-success btn-square" onClick={handleTitleSave}>
                       <Check size={16} />
                    </button>
                 </div>
              ) : (
                 <div 
                   className="flex items-center gap-2 cursor-pointer group p-1 rounded hover:bg-base-300 transition"
                   onClick={() => {
                      setTempTitle(boardTitle);
                      setIsEditingTitle(true);
                   }}
                 >
                    <h1 className="text-2xl font-bold">{boardTitle}</h1>
                    <Edit2 size={16} className="text-neutral-400 opacity-0 group-hover:opacity-100 transition" />
                 </div>
              )}
            </div>

            <div className="flex items-center gap-2">
                {statusMsg && <span className="text-sm text-neutral-500 mr-2">{statusMsg}</span>}
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/workspaces/${id}/boards`)}>
                Back to boards
                </button>
            </div>
          </div>

          {/* Whiteboard Canvas (Includes Controls) */}
          <WhiteboardCanvas 
            boardId={boardId} 
            socket={socketRef.current}
            initialSegments={initialSegments}
            me={me}
          />

          {/* Personal Notes */}
          <PersonalNotes 
            boardId={boardId} 
            token={token} 
          />

        </div>
      </main>
    </div>
  );
}

export default WhiteboardPage;