import React from "react";
import { X, Trash2, Loader2 } from "lucide-react";

export default function DeleteWorkspaceModal({
  isOpen,
  onClose,
  workspaceName,
  deleteConfirmName,
  setDeleteConfirmName,
  handleDeleteWorkspace,
  deletingWs,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-[#E8DDD0]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DDD0]">
          <h2 className="font-black text-red-600 font-display text-lg">
            Delete Workspace
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center transition"
          >
            <X size={18} className="text-[#6B6560] hover:text-red-500" />
          </button>
        </div>
        <div className="px-6 py-6 border-b border-[#E8DDD0] space-y-4">
          <p className="text-sm text-[#1A1A2E]">
            This action <span className="font-bold">cannot</span> be undone.
            This will permanently delete the
            <span className="font-bold"> {workspaceName} </span> workspace, all
            of its boards, and remove all members.
          </p>
          <div>
            <label className="text-xs font-bold text-[#1A1A2E] block mb-2">
              Please type{" "}
              <span className="text-red-600 font-black">{workspaceName}</span>{" "}
              to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                deleteConfirmName === workspaceName &&
                handleDeleteWorkspace()
              }
              className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] outline-none focus:ring-2 focus:ring-red-500/20"
            />
          </div>
        </div>
        <div className="px-6 py-4 bg-red-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="text-[#6B6560] hover:text-[#1A1A2E] text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteWorkspace}
            disabled={deletingWs || deleteConfirmName !== workspaceName}
            className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {deletingWs ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
