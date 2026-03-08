import React from "react";
import { X, Search, UserPlus, Loader2, Trash2, ChevronDown } from "lucide-react";

export default function MembersModal({
  isOpen,
  onClose,
  workspaceName,
  inviteEmail,
  setInviteEmail,
  handleInvite,
  inviting,
  inviteError,
  inviteSuccess,
  inviteFocused,
  setInviteFocused,
  suggestedUsers,
  setSuggestedUsers,
  memberSearchTerm,
  setMemberSearchTerm,
  workspaceMembers,
  wsColor,
  handleRemoveMember,
  handleRoleChange,
  isOwner,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-visible border border-[#E8DDD0]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DDD0]">
          <div>
            <h2 className="font-black text-[#1A1A2E] font-display text-lg">
              Members
            </h2>
            <p className="text-xs text-[#6B6560] mt-0.5">{workspaceName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#F5EAD8] flex items-center justify-center transition"
          >
            <X size={18} className="text-[#6B6560]" />
          </button>
        </div>

        {/* Invite Input */}
        <div className="px-6 py-4 border-b border-[#E8DDD0] bg-[#F5EAD8]/50 relative">
          <p className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest mb-2">
            Invite by email
          </p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="email"
                placeholder="colleague@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                onFocus={() => setInviteFocused(true)}
                onBlur={() => {
                  setInviteFocused(false);
                  setSuggestedUsers([]);
                }}
                className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] placeholder-[#6B6560] outline-none focus:ring-2 focus:ring-[#244e8a]/20"
              />
              {/* Autocomplete Dropdown */}
              {suggestedUsers.length > 0 && inviteFocused && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E8DDD0] rounded-xl shadow-xl z-[70] max-h-56 overflow-y-auto">
                  {suggestedUsers.map((u) => (
                    <div
                      key={u._id}
                      onMouseDown={() => {
                        setInviteEmail(u.email);
                        setSuggestedUsers([]);
                      }}
                      className="px-4 py-2 hover:bg-[#F5EAD8] cursor-pointer flex flex-col transition-colors border-b border-[#E8DDD0] last:border-b-0"
                    >
                      <span className="text-sm font-bold text-[#1A1A2E]">
                        {u.name}
                      </span>
                      <span className="text-xs text-[#6B6560]">{u.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleInvite}
              disabled={inviting}
              className="bg-[#244e8a] text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-[#1d3f70] transition disabled:opacity-50 flex items-center gap-2 h-[38px] shrink-0"
            >
              {inviting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <UserPlus size={14} />
              )}
              Invite
            </button>
          </div>
          {inviteError && (
            <p className="text-xs text-red-500 mt-2">{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="text-xs text-green-600 mt-2">{inviteSuccess}</p>
          )}
        </div>

        {/* Members List */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest">
              Current members ({workspaceMembers.length})
            </p>
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B6560]"
              />
              <input
                type="text"
                placeholder="Search members..."
                value={memberSearchTerm}
                onChange={(e) => setMemberSearchTerm(e.target.value)}
                className="bg-[#F5EAD8] text-xs border border-[#E8DDD0] rounded-full pl-8 pr-3 py-1.5 w-40 outline-none focus:ring-2 focus:ring-[#244e8a]/20 text-[#1A1A2E] placeholder-[#6B6560]"
              />
            </div>
          </div>
          <div className="space-y-2">
            {workspaceMembers
              .filter(
                (m) =>
                  (m.name || "")
                    .toLowerCase()
                    .includes(memberSearchTerm.toLowerCase()) ||
                  (m.email || "")
                    .toLowerCase()
                    .includes(memberSearchTerm.toLowerCase())
              )
              .map((m) => (
                <div
                  key={m._id}
                  className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[#F5EAD8] transition group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: wsColor(m._id) }}
                    >
                      {(m.name || m.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1A1A2E]">
                        {m.name || "Unknown"}
                      </p>
                      <p className="text-xs text-[#6B6560]">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Remove button — owner only, can't remove self or other owners */}
                    {isOwner && m.role !== "owner" && (
                      <button
                        onClick={() => handleRemoveMember(m._id)}
                        className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    )}
                    {/* Role badge/dropdown */}
                    {isOwner && m.role !== "owner" ? (
                      <div className="dropdown dropdown-bottom dropdown-end">
                        <div
                          tabIndex={0}
                          role="button"
                          className={`text-[10px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all shadow-sm ${
                            m.role === "owner"
                              ? "bg-[#244e8a] text-white hover:bg-[#1e3e6e]"
                              : m.role === "editor"
                              ? "bg-[#FFD93D] text-[#1A1A2E] hover:bg-[#e6c437]"
                              : "bg-[#E8DDD0] text-[#6B6560] hover:bg-[#d8cdc0]"
                          }`}
                        >
                          {m.role}
                          <ChevronDown size={10} className="opacity-70" />
                        </div>
                        <ul
                          tabIndex={0}
                          className="dropdown-content z-[50] menu p-1.5 shadow-xl bg-white rounded-xl w-36 mt-1 border border-[#E8DDD0] animate-in fade-in zoom-in duration-200"
                        >
                          <li>
                            <button
                              onClick={() => handleRoleChange(m._id, "viewer")}
                              className={`flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold rounded-lg ${
                                m.role === "viewer"
                                  ? "bg-[#E8DDD0]/30 text-[#6B6560]"
                                  : "text-[#6B6560] hover:bg-neutral-50"
                              }`}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-[#E8DDD0]" />
                              VIEWER
                            </button>
                          </li>
                          <li>
                            <button
                              onClick={() => handleRoleChange(m._id, "editor")}
                              className={`flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold rounded-lg ${
                                m.role === "editor"
                                  ? "bg-[#FFD93D]/20 text-[#1A1A2E]"
                                  : "text-[#1A1A2E] hover:bg-neutral-50"
                              }`}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-[#FFD93D]" />
                              EDITOR
                            </button>
                          </li>
                          <li>
                            <button
                              onClick={() => handleRoleChange(m._id, "owner")}
                              className={`flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold rounded-lg ${
                                m.role === "owner"
                                  ? "bg-[#244e8a]/10 text-[#244e8a]"
                                  : "text-[#244e8a] hover:bg-neutral-50"
                              }`}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-[#244e8a]" />
                              OWNER
                            </button>
                          </li>
                        </ul>
                      </div>
                    ) : (
                      <span
                        className={`text-[10px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-full shadow-sm ${
                          m.role === "owner"
                            ? "bg-[#244e8a] text-white"
                            : m.role === "editor"
                            ? "bg-[#FFD93D] text-[#1A1A2E]"
                            : "bg-[#E8DDD0] text-[#6B6560]"
                        }`}
                      >
                        {m.role}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
