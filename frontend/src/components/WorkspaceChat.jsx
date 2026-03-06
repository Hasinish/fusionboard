import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import api, { API_URL } from "../lib/api";
import { getUser } from "../lib/auth";
import { Send, MessageSquare } from "lucide-react";

export default function WorkspaceChat({ workspaceId }) {
  const me = getUser();
  const token = useMemo(() => localStorage.getItem("token"), []);
  const socketRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("connecting...");
  const bottomRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        const res = await api.get(`/workspaces/${workspaceId}/messages?limit=80`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(Array.isArray(res.data) ? res.data : []);
      } catch {
        // shhh, swallow the error
      }
    };
    load();
  }, [workspaceId, token]);

  // wire up the real-time chat connection
  useEffect(() => {
    if (!token) return;

    // grab the right url for the websocket
    const socketUrl = API_URL.replace("/api", "");

    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));

    socket.emit("workspace:join", { workspaceId }, (ack) => {
      if (!ack?.ok) setStatus(ack?.message || "join failed");
    });

    socket.on("chat:new", (msg) => {
      if (String(msg.workspace) !== String(workspaceId)) return;
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("chat:new");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [workspaceId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const clean = text.trim();
    if (!clean) return;

    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      setStatus("disconnected");
      return;
    }

    socket.emit("chat:send", { workspaceId, text: clean }, (ack) => {
      if (!ack?.ok) setStatus(ack?.message || "Send failed");
    });
    setText("");
  };

  const getAvatarColor = (name) => {
    if (!name) return "#244e8a";
    const colors = ["#244e8a", "#FFD93D", "#6BCB77", "#FF6B6B", "#C77DFF"];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-white space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">
            No messages yet. Say hi 👋
          </div>
        ) : (
          <>
            {messages.map((m) => {
              const isMine = me?.id && (m.sender?._id === me.id || m.sender === me.id);

              if (isMine) {
                return (
                  <div key={m._id} className="flex items-end justify-end">
                    <div className="bg-[#244e8a] rounded-2xl rounded-br-none px-4 py-3 text-sm text-white max-w-[75%] shadow-sm">
                      {m.text}
                    </div>
                  </div>
                );
              }

              const senderName = m.sender?.name || "Unknown";
              return (
                <div key={m._id} className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: getAvatarColor(senderName) }}
                  >
                    {senderName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col max-w-[75%]">
                    <span className="text-xs text-[#6B6560] mb-1 font-medium ml-1">
                      {senderName}
                    </span>
                    <div className="bg-white border border-[#E8DDD0] rounded-2xl rounded-tl-none px-4 py-3 text-sm text-[#1A1A2E] shadow-sm">
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input Bar */}
      <div className="px-4 py-3 bg-white border-t border-[#E8DDD0] shrink-0">
        <form onSubmit={send} className="flex items-center gap-2 bg-[#F5EAD8] border border-[#E8DDD0] rounded-full px-4 py-2">
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder-[#6B6560] text-[#1A1A2E]"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(e)}
            placeholder="Type a message..."
          />
          <button
            type="submit"
            className="w-8 h-8 bg-[#244e8a] rounded-full flex items-center justify-center cursor-pointer hover:bg-[#1d3f70] shrink-0 transition-colors shadow-sm"
          >
            <Send size={14} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}