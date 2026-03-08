import React from "react";
import { X, Plus, Loader2, CheckCircle } from "lucide-react";

export default function CreateWorkspaceModal({
  isOpen,
  onClose,
  newWsName,
  setNewWsName,
  newWsDescription,
  setNewWsDescription,
  newWsEmails,
  setNewWsEmails,
  creatingWs,
  wsCreateError,
  wsCreateSuccess,
  handleCreateWorkspace,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-[#E8DDD0]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DDD0]">
          <div>
            <h2 className="font-black text-[#1A1A2E] font-display text-lg">
              Create Workspace
            </h2>
            <p className="text-xs text-[#6B6560] mt-0.5">
              Start a new visual project
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#F5EAD8] flex items-center justify-center transition"
          >
            <X size={18} className="text-[#6B6560]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest block mb-2">
              Workspace Name
            </label>
            <input
              type="text"
              placeholder="e.g. Design Team, Marketing"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] placeholder-[#6B6560] outline-none focus:ring-2 focus:ring-[#244e8a]/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest block mb-2">
              Description
            </label>
            <textarea
              placeholder="Short description of this workspace..."
              value={newWsDescription}
              onChange={(e) => setNewWsDescription(e.target.value)}
              rows={2}
              className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] placeholder-[#6B6560] outline-none focus:ring-2 focus:ring-[#244e8a]/20 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest block mb-2">
              Invite Members (Optional)
            </label>
            <textarea
              placeholder="friend@email.com, colleague@email.com"
              value={newWsEmails}
              onChange={(e) => setNewWsEmails(e.target.value)}
              rows={2}
              className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] placeholder-[#6B6560] outline-none focus:ring-2 focus:ring-[#244e8a]/20 resize-none"
            />
            <p className="text-[10px] text-[#6B6560] mt-2 italic">
              Separate emails with commas.
            </p>
          </div>

          {wsCreateError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
              <X size={14} className="text-red-500" />
              <p className="text-xs text-red-600 font-medium">
                {wsCreateError}
              </p>
            </div>
          )}

          {wsCreateSuccess && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
              <CheckCircle size={14} className="text-green-500" />
              <p className="text-xs text-green-600 font-medium">
                {wsCreateSuccess}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#F5EAD8]/30 flex justify-end">
          <button
            onClick={handleCreateWorkspace}
            disabled={creatingWs || !newWsName.trim()}
            className="bg-[#244e8a] text-white rounded-lg px-6 py-2.5 text-sm font-bold hover:bg-[#1d3f70] transition disabled:opacity-50 flex items-center gap-2"
          >
            {creatingWs ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Create Workspace
          </button>
        </div>
      </div>
    </div>
  );
}
