import React from "react";
import { X, CheckCircle, Loader2 } from "lucide-react";

export default function RenameWorkspaceModal({
  isOpen,
  onClose,
  renameWsName,
  setRenameWsName,
  handleRenameWorkspace,
  renamingWs,
  workspaceName,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-[#E8DDD0]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DDD0]">
          <h2 className="font-black text-[#1A1A2E] font-display text-lg">
            Rename Workspace
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#F5EAD8] flex items-center justify-center transition"
          >
            <X size={18} className="text-[#6B6560]" />
          </button>
        </div>
        <div className="px-6 py-6 border-b border-[#E8DDD0]">
          <label className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest block mb-2">
            Workspace Name
          </label>
          <input
            type="text"
            value={renameWsName}
            onChange={(e) => setRenameWsName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameWorkspace()}
            className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] outline-none focus:ring-2 focus:ring-[#244e8a]/20"
          />
        </div>
        <div className="px-6 py-4 bg-[#F5EAD8]/30 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="text-[#6B6560] hover:text-[#1A1A2E] text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleRenameWorkspace}
            disabled={
              renamingWs ||
              !renameWsName.trim() ||
              renameWsName === workspaceName
            }
            className="bg-[#244e8a] text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-[#1d3f70] transition disabled:opacity-50 flex items-center gap-2"
          >
            {renamingWs ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
