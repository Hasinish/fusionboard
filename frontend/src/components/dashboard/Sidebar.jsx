import React from "react";
import { Sparkles, Plus, LogOut, LayoutGrid, Calendar } from "lucide-react";

export default function Sidebar({
  isMobile,
  showSidebar,
  setShowSidebar,
  isCompact,
  workspaces,
  selectedWorkspaceId,
  navigate,
  handleLogout,
  setShowAddWsModal,
  setWsCreateError,
  setWsCreateSuccess,
  activeTab,
  setActiveTab,
}) {
  const wsColor = (id) => {
    if (!id) return "#4f46e5";
    const colors = [
      "#244e8a",
      "#FFD93D",
      "#6BCB77",
      "#FF6B6B",
      "#C77DFF",
      "#4ECDC4",
      "#F9844A",
      "#277DA1",
    ];
    let sum = 0;
    for (let i = 0; i < id.length; i++) {
      sum += id.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-[45]"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`bg-white border-r border-[#E8DDD0] flex flex-col py-6 px-4 shrink-0 transition-all duration-300 
        ${isMobile ? "fixed h-full z-50 shadow-2xl" : "relative z-10"} 
        ${!showSidebar 
          ? (isMobile ? "-translate-x-full" : "w-0 px-0 opacity-0 overflow-hidden border-none") 
          : (isCompact && !isMobile ? "w-20" : "w-64")
        }`}
      >
        <div
          className={`flex items-center gap-3 px-2 mb-8 ${
            isCompact ? "justify-center" : ""
          }`}
        >
          <div className="w-8 h-8 bg-[#244e8a] rounded-lg flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          {!isCompact && (
            <span className="font-black text-[#1A1A2E] text-lg tracking-tight font-display">
              FusionBoard
            </span>
          )}
        </div>

        {/* Main Navigation */}
        <div className="mb-8 space-y-1">
          {!isCompact && (
            <p className="text-xs font-bold text-[#6B6560] uppercase tracking-widest px-2 mb-2">
              Main Menu
            </p>
          )}
          
          <button
            onClick={() => setActiveTab("boards")}
            className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-lg transition mb-1 ${
              activeTab === "boards"
                ? "bg-[#F5EAD8] border-l-4 border-[#1A1A2E] font-bold text-[#1A1A2E]"
                : "text-[#6B6560] hover:bg-[#F5EAD8] hover:text-[#1A1A2E] border-l-4 border-transparent"
            } ${isCompact ? "justify-center" : ""}`}
            title={isCompact ? "Boards" : ""}
          >
            <LayoutGrid size={18} />
            {!isCompact && <span className="text-sm">Boards</span>}
          </button>

          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-lg transition mb-1 ${
              activeTab === "calendar"
                ? "bg-[#F5EAD8] border-l-4 border-[#1A1A2E] font-bold text-[#1A1A2E]"
                : "text-[#6B6560] hover:bg-[#F5EAD8] hover:text-[#1A1A2E] border-l-4 border-transparent"
            } ${isCompact ? "justify-center" : ""}`}
            title={isCompact ? "Calendar" : ""}
          >
            <Calendar size={18} />
            {!isCompact && <span className="text-sm">Calendar</span>}
          </button>
        </div>

        {!isCompact && (
          <p className="text-xs font-bold text-[#6B6560] uppercase tracking-widest px-2 mb-2">
            Workspaces
          </p>
        )}

        <div className="space-y-1">
          {workspaces.map((ws) => (
            <div
              key={ws._id}
              onClick={() => navigate(`/dashboard?wsId=${ws._id}`)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition mb-1 ${
                selectedWorkspaceId === ws._id
                  ? "bg-[#F5EAD8] border-l-4 border-[#1A1A2E] font-bold text-[#1A1A2E]"
                  : "text-[#6B6560] hover:bg-[#F5EAD8] hover:text-[#1A1A2E] border-l-4 border-transparent"
              } ${isCompact ? "justify-center" : ""}`}
              title={isCompact ? ws.name : ""}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: wsColor(ws._id) }}
              >
                {ws.name.substring(0, 2).toUpperCase()}
              </div>
              {!isCompact && (
                <span className="text-sm truncate">{ws.name}</span>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setWsCreateError("");
            setWsCreateSuccess("");
            setShowAddWsModal(true);
          }}
          className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-[#6B6560] hover:bg-[#F5EAD8] hover:text-[#1A1A2E] transition mt-1 border-l-4 border-transparent ${
            isCompact ? "justify-center" : ""
          }`}
          title={isCompact ? "Add Workspace" : ""}
        >
          <div className="w-7 h-7 rounded-md border-2 border-dashed border-[#C8BDB5] flex items-center justify-center shrink-0">
            <Plus size={14} />
          </div>
          {!isCompact && <span className="text-sm">Add Workspace</span>}
        </button>

        <div className="mt-auto pt-4 border-t border-[#E8DDD0]">
          {!isCompact && (
            <div className="bg-[#F5EAD8] border border-[#E8DDD0] rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-[#1A1A2E] mb-1 font-display">
                Pro Plan
              </p>
              <p className="text-xs text-[#6B6560] mb-3">
                Get unlimited boards and collaborators.
              </p>
              <button className="w-full bg-[#1A1A2E] text-white text-xs font-bold py-2 rounded-lg hover:bg-[#2d2d4e] transition">
                Upgrade
              </button>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2 w-full rounded-lg text-[#6B6560] hover:bg-[#F5EAD8] transition ${
              isCompact ? "justify-center" : ""
            }`}
          >
            <LogOut size={16} />
            {!isCompact && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
