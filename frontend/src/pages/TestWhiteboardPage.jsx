import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { ArrowLeft, Settings2, Trash2 } from "lucide-react";
import TestInfiniteCanvas from "../components/TestInfiniteCanvas";
import VoiceChat from "../components/VoiceChat";
import { getUser, isLoggedIn } from "../lib/auth";
import { API_URL } from "../lib/api";

function TestWhiteboardPage() {
    const navigate = useNavigate();
    const me = getUser();
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    const [socket, setSocket] = useState(null);
    const [talkingUserIds, setTalkingUserIds] = useState([]);

    useEffect(() => {
        if (!isLoggedIn()) navigate("/login");
    }, [navigate]);

    // wire up the realtime connection with a dummy board ID
    useEffect(() => {
        const socketUrl = API_URL.replace("/api", "");

        const newSocket = io(socketUrl, {
            auth: { token },
            transports: ["websocket", "polling"],
            reconnection: true,
        });
        setSocket(newSocket);

        newSocket.on("connect", () => {
            // using a hardcoded string so everyone joins the same infinite test room
            newSocket.emit("joinBoard", {
                boardId: "infinite-test-room",
                user: { name: me?.name || "Tester" },
            });
        });

        return () => {
            newSocket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="w-screen h-screen m-0 p-0 overflow-hidden relative font-sans">
            <TestInfiniteCanvas
                boardId={"infinite-test-room"}
                socket={socket}
                initialSegments={[]}
                me={me}
                talkingUserIds={talkingUserIds}
                renderTopLeftUI={({ setBgMode, clearBoard, isDark, setIsDark }) => {
                    const topBtnClass = `ui-container flex items-center justify-center border shadow-lg pointer-events-auto transition-all ${isDark ? "bg-[#1f1f1f] border-[#333333] text-white/70 hover:bg-white/10 hover:text-white" : "bg-base-100/95 border-base-200 text-base-content hover:bg-base-200"}`;
                    return (
                        <>
                            <button
                                className={`${topBtnClass} rounded-full px-5 py-2 gap-2 backdrop-blur-md active:scale-95`}
                                onClick={() => navigate('/dashboard')}
                            >
                                <ArrowLeft size={18} /> Dashboard
                            </button>
                            <details className="ui-container dropdown dropdown-bottom dropdown-start pointer-events-auto flex items-center">
                                <summary className={`${topBtnClass} w-10 h-10 rounded-full list-none cursor-pointer backdrop-blur-md active:scale-95`}><Settings2 className="w-5 h-5" /></summary>
                                <ul className={`dropdown-content z-50 menu p-3 shadow-2xl rounded-2xl w-64 mt-4 border backdrop-blur-xl ${isDark ? "bg-[#1f1f1f] border-[#333333] text-white" : "bg-base-100 border-base-200"}`}>
                                    <li className={`menu-title text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/60" : "opacity-40"} px-4 pb-2`}>Background</li>
                                    <li><a onClick={() => setBgMode("white")} className={`${isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-primary/10"} py-2.5 px-4 rounded-xl`}>Solid White</a></li>
                                    <li><a onClick={() => setBgMode("dots")} className={`${isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-primary/10"} py-2.5 px-4 rounded-xl`}>Dotted Grid</a></li>
                                    <li><a onClick={() => setBgMode("grid")} className={`${isDark ? "hover:bg-white/10 hover:text-white" : "hover:bg-primary/10"} py-2.5 px-4 rounded-xl`}>Infinite Grid</a></li>

                                    <div className={`h-px my-2 ${isDark ? "bg-white/10" : "bg-base-300"} mx-4`} />
                                    <li className={`menu-title text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/60" : "opacity-40"} px-4 py-2`}>Theme</li>
                                    <li className="px-4 py-2">
                                        <div className="flex items-center justify-between gap-4 p-0 hover:bg-transparent">
                                            <div className="flex items-center gap-2">
                                                <span role="img" aria-label="moon">{isDark ? "🌙" : "☀️"}</span>
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

                                    <div className={`h-px my-2 ${isDark ? "bg-white/10" : "bg-base-300"} mx-4`} />
                                    <li className={`menu-title text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/60" : "opacity-40"} px-4 py-2`}>Danger</li>
                                    <li><a onClick={clearBoard} className="text-error hover:bg-error/10 font-bold py-2.5 px-4 rounded-xl"><Trash2 className="w-5 h-5" /> Clear Canvas</a></li>
                                </ul>
                            </details>
                        </>
                    );
                }}
            />
            <VoiceChat roomId="infinite-test-room" autoJoin={false} onSpeakingChange={setTalkingUserIds} />
        </div>
    );
}

export default TestWhiteboardPage;
