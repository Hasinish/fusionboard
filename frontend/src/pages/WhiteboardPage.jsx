import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { ArrowLeft, Settings2, Trash2, Check, Loader2, History } from "lucide-react";
import TestInfiniteCanvas from "../components/TestInfiniteCanvas";
import VoiceChat from "../components/VoiceChat";
import RecordingListModal from "../components/replay/RecordingListModal";
import { getUser, isLoggedIn } from "../lib/auth";
import api, { API_URL } from "../lib/api";

function WhiteboardPage() {
  const navigate = useNavigate();
  const { id, boardId } = useParams();
  const me = getUser();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;


  const [talkingUserIds, setTalkingUserIds] = useState([]);
  const [boardTitle, setBoardTitle] = useState("Loading...");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const [userRole, setUserRole] = useState(null); // null = loading, "owner"/"editor"/"viewer"
  const [showRecordings, setShowRecordings] = useState(false);

  const isViewer = userRole === "viewer";

  useEffect(() => {
    if (!isLoggedIn()) navigate("/");
  }, [navigate]);

  // Fetch board title + workspace role on mount
  useEffect(() => {
    if (!token || !boardId || !id) return;

    // Fetch board title
    api.get(`/boards/${boardId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setBoardTitle(res.data.title || "Untitled Board"))
      .catch(() => setBoardTitle("Untitled Board"));

    // Fetch workspace to resolve current user's role
    api.get(`/workspaces/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        const ws = res.data;
        const members = ws.members || [];
        const member = members.find(m => String(m._id) === String(me?.id ?? me?._id));
        setUserRole(member?.role || "viewer");
      })
      .catch(() => setUserRole("viewer")); // fail-safe: restrict to viewer
  }, [boardId, id, token, me?.id]);

  // Register presence via Socket.IO so the dashboard shows live avatars
  useEffect(() => {
    if (!boardId || !token || !me) return;
    const socket = io(API_URL.replace("/api", ""), { auth: { token } });
    const emitJoin = () => {
      socket.emit("joinBoard", { boardId, user: { name: me.name, avatar: me.avatar } });
    };
    if (socket.connected) emitJoin();
    socket.on("connect", emitJoin);
    return () => {
      socket.emit("leaveBoard");
      socket.disconnect();
    };
  }, [boardId, token, me?.id]);

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
    } catch {
      // Revert on failure
      api.get(`/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(res => setBoardTitle(res.data.title || "Untitled Board"));
    }
  };



  // Show loading until role is resolved (prevents viewer toolbar flash)
  if (userRole === null) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-base-200">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen m-0 p-0 overflow-hidden relative font-sans">
      <TestInfiniteCanvas
        boardId={boardId}
        boardTitle={boardTitle}
        me={me}
        talkingUserIds={talkingUserIds}
        isViewer={isViewer}
        workspaceId={id}
        renderTopLeftUI={({ setBgMode, clearBoard, isDark, setIsDark }) => {
          const topBtnClass = `ui-container flex items-center justify-center bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg pointer-events-auto transition-all rounded-lg ${isDark ? "text-white/70 hover:bg-white/25 hover:text-white" : "text-base-content/80 hover:bg-white/30 hover:text-base-content"}`;
          return (
            <>
              <button
                className={`${topBtnClass} px-5 py-2 gap-2 active:scale-95`}
                onClick={() => navigate(`/dashboard?wsId=${id}`)}
              >
                <ArrowLeft size={18} /> Dashboard
              </button>

              {/* Editable board title (viewers see read-only) */}
              {isViewer ? (
                <span className={`${topBtnClass} px-4 py-1.5 text-sm font-semibold`}>
                  {boardTitle}
                </span>
              ) : isEditingTitle ? (
                <div className="ui-container flex items-center gap-1 pointer-events-auto">
                  <input
                    className={`${topBtnClass} px-3 py-1.5 text-sm font-semibold w-48 outline-none`}
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTitleSave();
                      if (e.key === "Escape") setIsEditingTitle(false);
                    }}
                  />
                  <button className={`${topBtnClass} w-8 h-8 active:scale-95`} onClick={handleTitleSave}>
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <span
                  className={`${topBtnClass} px-4 py-1.5 text-sm font-semibold cursor-pointer active:scale-95`}
                  onClick={() => {
                    setTempTitle(boardTitle);
                    setIsEditingTitle(true);
                  }}
                >
                  {boardTitle}
                </span>
              )}

              <details className="ui-container dropdown dropdown-bottom dropdown-start pointer-events-auto flex items-center">
                <summary className={`${topBtnClass} w-10 h-10 list-none cursor-pointer active:scale-95`}><Settings2 className="w-5 h-5" /></summary>
                <ul className={`dropdown-content z-50 menu p-3 shadow-2xl rounded-2xl w-64 mt-4 border backdrop-blur-xl ${isDark ? "bg-[#1f1f1f] border-[#333333] text-white" : "bg-base-100 border-base-200"}`}>
                  <li className={`menu-title text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/60" : "opacity-40"} px-4 pb-2`}>Background</li>
                  <li><a onClick={() => setBgMode("white")} className={`${isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-primary/10"} py-2.5 px-4 rounded-xl`}>Solid</a></li>
                  <li><a onClick={() => setBgMode("dots")} className={`${isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-primary/10"} py-2.5 px-4 rounded-xl`}>Dotted Grid</a></li>
                  <li><a onClick={() => setBgMode("grid")} className={`${isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-primary/10"} py-2.5 px-4 rounded-xl`}>Infinite Grid</a></li>

                  <div className={`h-px my-2 ${isDark ? "bg-white/10" : "bg-base-300"} mx-4`} />
                  <li className={`menu-title text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/60" : "opacity-40"} px-4 py-2`}>Theme</li>
                  <li className="px-4 py-2">
                    <div className="flex items-center justify-between gap-4 p-0 hover:bg-transparent">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{isDark ? "Dark Mode" : "Light Mode"}</span>
                      </div>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-sm"
                        checked={isDark}
                        onChange={(e) => setIsDark(e.target.checked)}
                      />
                    </div>
                  </li>

                  {!isViewer && (
                    <>
                      <div className={`h-px my-2 ${isDark ? "bg-white/10" : "bg-base-300"} mx-4`} />
                      <li className={`menu-title text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/60" : "opacity-40"} px-4 py-2`}>Recordings</li>
                      <li><a onClick={() => setShowRecordings(true)} className={`${isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-primary/10"} py-2.5 px-4 rounded-xl flex items-center gap-3`}><History size={18} /> View Recordings</a></li>
                      
                      <div className={`h-px my-2 ${isDark ? "bg-white/10" : "bg-base-300"} mx-4`} />
                      <li className={`menu-title text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/60" : "opacity-40"} px-4 py-2`}>Danger</li>
                      <li><a onClick={clearBoard} className="text-error hover:bg-error/10 font-bold py-2.5 px-4 rounded-xl"><Trash2 className="w-5 h-5" /> Clear Canvas</a></li>
                    </>
                  )}
                </ul>
              </details>
            </>
          );
        }}
      />
      <VoiceChat roomId={boardId} autoJoin={false} onSpeakingChange={setTalkingUserIds} isViewer={isViewer} />
      
      {showRecordings && (
        <RecordingListModal 
          boardId={boardId} 
          onClose={() => setShowRecordings(false)} 
          isDark={userRole === "viewer" ? true : false /* This logic might need refinement */}
        />
      )}
    </div>
  );
}

export default WhiteboardPage;