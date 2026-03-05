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
                renderTopLeftUI={({ setBgMode, clearBoard }) => (
                    <>
                        <button
                            className="ui-container btn btn-neutral shadow-lg gap-2 pointer-events-auto"
                            onClick={() => navigate('/dashboard')}
                        >
                            <ArrowLeft size={20} /> Dashboard
                        </button>
                        <details className="ui-container dropdown dropdown-bottom dropdown-start pointer-events-auto">
                            <summary className="btn btn-neutral shadow-lg btn-circle list-none"><Settings2 className="w-5 h-5" /></summary>
                            <ul className="dropdown-content z-50 menu p-3 shadow-xl bg-base-100 rounded-box w-60 mt-4 border border-base-200">
                                <li className="menu-title text-sm px-4">Background</li>
                                <li><a onClick={() => setBgMode("white")}>Solid White</a></li>
                                <li><a onClick={() => setBgMode("dots")}>Dotted Grid</a></li>
                                <li><a onClick={() => setBgMode("grid")}>Infinite Grid</a></li>
                                <div className="divider my-1" />
                                <li className="menu-title text-sm px-4">Actions</li>
                                <li><a onClick={clearBoard} className="text-error"><Trash2 className="w-5 h-5" /> Clear Canvas</a></li>
                            </ul>
                        </details>
                    </>
                )}
            />
            <VoiceChat roomId="infinite-test-room" autoJoin={false} onSpeakingChange={setTalkingUserIds} />
        </div>
    );
}

export default TestWhiteboardPage;
