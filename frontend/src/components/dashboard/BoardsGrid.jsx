import React from "react";
import {
  LayoutGrid,
  List,
  Plus,
  Loader2,
  Map,
  Clock,
  Edit2,
  Trash2,
} from "lucide-react";

export default function BoardsGrid({
  viewMode,
  setViewMode,
  handleCreateBoard,
  creating,
  loadingBoards,
  filteredBoards,
  navigate,
  selectedWorkspaceId,
  loadingWorkspaces,
  setTargetBoardId,
  setRenameBoardTitle,
  setShowBoardRenameModal,
  handleDeleteBoard,
  myRole,
}) {
  const isViewer = myRole === "viewer";
  const timeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1A1A2E] font-display">
            Boards
          </h1>
          <p className="text-sm text-[#6B6560] mt-1">Manage visual projects</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 transition-colors ${
              viewMode === "grid"
                ? "text-[#1A1A2E] bg-white border border-[#E8DDD0] rounded-lg"
                : "text-[#6B6560] hover:text-[#1A1A2E] hover:bg-white rounded-lg"
            }`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 transition-colors ${
              viewMode === "list"
                ? "text-[#1A1A2E] bg-white border border-[#E8DDD0] rounded-lg"
                : "text-[#6B6560] hover:text-[#1A1A2E] hover:bg-white rounded-lg"
            }`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {viewMode === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
          {/* New Board Card - Hidden for viewers */}
          {!isViewer && (
            <div
              onClick={handleCreateBoard}
              className="bg-[#1A1A2E] rounded-2xl cursor-pointer hover:bg-[#2d2d4e] hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-3 h-[180px] border-2 border-[#1A1A2E]"
            >
              {creating ? (
                <Loader2 className="animate-spin text-white w-10 h-10" />
              ) : (
                <>
                  <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                    <Plus size={28} className="text-white" />
                  </div>
                  <span className="text-white font-semibold text-sm mt-2 font-display">
                    New Board
                  </span>
                </>
              )}
            </div>
          )}

          {loadingBoards ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#EDE3D5] animate-pulse rounded-2xl h-[190px]"
              />
            ))
          ) : filteredBoards.length === 0 && !loadingWorkspaces ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center h-[180px]">
              <Map size={56} className="text-[#C8BDB5] mb-4" />
              <h3 className="text-lg font-semibold text-[#1A1A2E]">
                No boards yet
              </h3>
              <p className="text-[#6B6560] max-w-xs">
                {isViewer
                  ? "There are no boards in this workspace yet."
                  : "Create your first board to get started with your projects."}
              </p>
            </div>
          ) : (
            filteredBoards.map((b) => (
              <div
                key={b._id}
                onClick={() =>
                  navigate(
                    `/workspaces/${selectedWorkspaceId}/boards/${b._id}`
                  )
                }
                className="bg-white border border-[#E8DDD0] rounded-2xl cursor-pointer hover:border-[#244e8a] hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col group relative overflow-hidden h-[190px]"
              >
                {/* Preview Area */}
                <div className="flex-1 min-h-0 relative flex items-center justify-center p-6">
                  <svg
                    width="80"
                    height="60"
                    viewBox="0 0 80 60"
                    className="opacity-40"
                  >
                    <rect
                      x="5"
                      y="5"
                      width="70"
                      height="50"
                      rx="4"
                      stroke="#6AB5B8"
                      strokeWidth="2"
                      fill="none"
                    />
                    <rect
                      x="15"
                      y="15"
                      width="30"
                      height="20"
                      rx="2"
                      fill="#6AB5B8"
                    />
                    <circle cx="55" cy="25" r="8" fill="#6AB5B8" />
                    <rect
                      x="15"
                      y="40"
                      width="50"
                      height="4"
                      rx="2"
                      fill="#6AB5B8"
                    />
                  </svg>
                </div>

                {/* Info Bar */}
                <div className="px-4 py-3 bg-white border-t border-[#E8DDD0] h-[60px] shrink-0 flex flex-col justify-center">
                  <h3 className="text-sm font-bold text-[#1A1A2E] truncate leading-tight font-display">
                    {b.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#6B6560] mt-0.5 leading-tight flex items-center gap-1">
                      <Clock size={10} />
                      {timeAgo(b.updatedAt)}
                    </span>
                    <div className="flex -space-x-2">
                      {b.activeUsers?.slice(0, 3).map((u, idx) => (
                        <div
                          key={idx}
                          className="w-5 h-5 rounded-full border-2 border-white bg-[#E8DDD0] overflow-hidden"
                          title={u.name}
                        >
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#244e8a] text-white text-[8px] font-black uppercase">
                              {u.name.charAt(0)}
                            </div>
                          )}
                        </div>
                      ))}
                      {b.activeUsers?.length > 3 && (
                        <div
                          className="w-5 h-5 rounded-full border-2 border-white bg-[#F5EAD8] text-[8px] flex items-center justify-center font-bold text-[#1A1A2E]"
                          title="More"
                        >
                          +{b.activeUsers.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons - Hidden for viewers */}
                {!isViewer && (
                  <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTargetBoardId(b._id);
                        setRenameBoardTitle(b.title);
                        setShowBoardRenameModal(true);
                      }}
                      className="w-8 h-8 bg-white border border-[#E8DDD0] shadow-sm rounded-full flex items-center justify-center hover:bg-[#F5EAD8] hover:text-[#244e8a] transition-all"
                    >
                      <Edit2 size={13} className="text-[#6B6560]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this board?"))
                          handleDeleteBoard(b._id);
                      }}
                      className="w-8 h-8 bg-white border border-[#E8DDD0] shadow-sm rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {viewMode === "list" && (
        <div className="mt-6 flex flex-col gap-2">
          {/* New Board Card - Hidden for viewers */}
          {!isViewer && (
            <div
              onClick={handleCreateBoard}
              className="bg-[#1A1A2E] hover:bg-[#2d2d4e] rounded-xl px-5 py-3 flex items-center gap-3 cursor-pointer transition-all"
            >
              <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                <Plus size={18} className="text-white" />
              </div>
              <span className="text-white font-semibold text-sm">New Board</span>
            </div>
          )}
          {loadingBoards ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-[#EDE3D5] rounded-xl h-14"
              />
            ))
          ) : (
            filteredBoards.map((b) => (
              <div
                key={b._id}
                onClick={() =>
                  navigate(
                    `/workspaces/${selectedWorkspaceId}/boards/${b._id}`
                  )
                }
                className="bg-white border border-[#E8DDD0] rounded-xl px-5 py-3 flex items-center justify-between cursor-pointer hover:border-[#244e8a] hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                    <svg
                      width="20"
                      height="16"
                      viewBox="0 0 80 60"
                      className="opacity-40"
                    >
                      <rect
                        x="5"
                        y="5"
                        width="70"
                        height="50"
                        rx="4"
                        stroke="#244e8a"
                        strokeWidth="3"
                        fill="none"
                      />
                      <rect
                        x="15"
                        y="15"
                        width="30"
                        height="20"
                        rx="2"
                        fill="#244e8a"
                      />
                      <circle cx="55" cy="25" r="8" fill="#244e8a" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A2E]">
                      {b.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-[#6B6560]">
                        {timeAgo(b.updatedAt)}
                      </p>
                      {b.activeUsers?.length > 0 && (
                        <div className="flex items-center px-1.5 py-0.5 rounded-full bg-green-50 border border-green-100 gap-1 scale-90 origin-left">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[9px] font-black text-green-700 uppercase tracking-tighter">
                            {b.activeUsers.length} Active
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {!isViewer && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTargetBoardId(b._id);
                        setRenameBoardTitle(b.title);
                        setShowBoardRenameModal(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full hover:bg-[#F5EAD8] flex items-center justify-center transition-all"
                    >
                      <Edit2 size={13} className="text-[#6B6560]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this board?"))
                          handleDeleteBoard(b._id);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center transition-all"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
