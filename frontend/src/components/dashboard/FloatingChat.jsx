import React from "react";
import { MessageSquare, X } from "lucide-react";
import WorkspaceChat from "../WorkspaceChat";

export default function FloatingChat({
  showChat,
  setShowChat,
  selectedWorkspaceId,
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {showChat && selectedWorkspaceId && (
        <div
          className="w-[340px] h-[480px] bg-white border border-[#E8DDD0] shadow-2xl rounded-2xl flex flex-col overflow-hidden"
          style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-[#1A1A2E] shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-white/70" />
              <span className="text-white font-semibold text-sm">
                Team Chat
              </span>
            </div>
            <X
              size={16}
              className="text-white/60 cursor-pointer hover:text-white"
              onClick={() => setShowChat(false)}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <WorkspaceChat workspaceId={selectedWorkspaceId} />
          </div>
        </div>
      )}
      <button
        onClick={() => setShowChat(!showChat)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all ${
          showChat ? "bg-red-500" : "bg-[#244e8a] hover:bg-[#1d3f70]"
        }`}
      >
        {showChat ? (
          <X size={22} className="text-white" />
        ) : (
          <MessageSquare size={22} className="text-white" />
        )}
      </button>
    </div>
  );
}
