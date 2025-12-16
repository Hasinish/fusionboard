// frontend/src/components/WorkspaceChat.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import api from "../lib/api";
import { getUser } from "../lib/auth";

function formatTime(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "";
  }
}

export default function WorkspaceChat({ workspaceId }) {
  const me = getUser();
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("connecting...");
  const bottomRef = useRef(null);

  // Load previous messages (persistent)
  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        const res = await api.get(`/workspaces/${workspaceId}/messages?limit=80`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(Array.isArray(res.data) ? res.data : []);
      } catch {
        // If not allowed / error, keep quiet
      }
    };
    load();
  }, [workspaceId, token]);

  // Realtime socket
  useEffect(() => {
    if (!token) return;

    const socket = io("http://localhost:5001", {
      auth: { token },
    });

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));

    socket.emit("workspace:join", { workspaceId }, (ack) => {
      if (!ack?.ok) {
        setStatus(ack?.message || "join failed");
      }
    });

    socket.on("chat:new", (msg) => {
      // Only accept messages for this workspace (extra safety)
      if (String(msg.workspace) !== String(workspaceId)) return;
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [workspaceId, token]);

  // Auto-scroll to latest
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;

    // Send via socket (faster). If socket is down, we just do nothing here.
    // (Simple version)
    const socket = io("http://localhost:5001", { auth: { token } });
    socket.emit("chat:send", { workspaceId, text: clean }, () => {
      socket.disconnect();
    });

    setText("");
  };

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-base">Workspace Chat</h2>
          <span className="text-xs text-neutral-500">{status}</span>
        </div>

        <div className="border border-base-200 rounded-lg p-3 h-72 overflow-y-auto bg-base-200">
          {messages.length === 0 ? (
            <div className="text-sm text-neutral-500">
              No messages yet. Say hi 👋
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((m) => {
                const mine = me?.id && m.sender?._id === me.id;
                return (
                  <div
                    key={m._id}
                    className={`chat ${mine ? "chat-end" : "chat-start"}`}
                  >
                    <div className="chat-header text-xs opacity-70">
                      {m.sender?.name || "Unknown"} • {formatTime(m.createdAt)}
                    </div>
                    <div className="chat-bubble">{m.text}</div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <form onSubmit={send} className="flex gap-2 mt-3">
          <input
            className="input input-bordered w-full"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
          />
          <button className="btn btn-primary" type="submit">
            Send
          </button>
        </form>

        <p className="text-xs text-neutral-500 mt-1">
          Messages are saved in MongoDB. Members can read old chat anytime.
        </p>
      </div>
    </div>
  );
}
