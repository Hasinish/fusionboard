import React from "react";
import {
  Menu,
  ChevronDown,
  Edit2,
  Trash2,
  Search,
  X,
  Folder,
  Users,
  Bell,
} from "lucide-react";
import NotificationsDropdown from "../NotificationsDropdown";
import api from "../../lib/api";
import { saveAuth } from "../../lib/auth";

export default function DashboardHeader({
  isMobile,
  showSidebar,
  onToggleSidebar,
  workspaceName,
  isOwner,
  showWorkspaceDropdown,
  setShowWorkspaceDropdown,
  setRenameWsName,
  setShowRenameModal,
  setDeleteConfirmName,
  setShowDeleteModal,
  isCompact,
  showMobileSearch,
  setShowMobileSearch,
  searchTerm,
  setSearchTerm,
  showMobileMenu,
  setShowMobileMenu,
  setFilesError,
  setFilesSuccess,
  setWorkspaceFiles,
  setFilesWorkspaceData,
  setShowFilesModal,
  fetchFilesWorkspaceData,
  fetchWorkspaceFiles,
  selectedWorkspaceId,
  setInviteError,
  setInviteSuccess,
  setShowMembersModal,
  notificationsRef,
  showNotifications,
  setShowNotifications,
  unreadCount,
  navigate,
  profile,
  setProfile,
  user,
}) {
  return (
    <header className="bg-white border-b border-[#E8DDD0] px-4 md:px-8 py-4 flex items-center justify-between shrink-0 relative">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 -ml-1 text-[#1A1A2E] hover:bg-[#F5EAD8] rounded-lg transition-colors flex items-center justify-center h-10 w-10"
          title="Toggle Sidebar"
        >
          <Menu size={24} />
        </button>
        <div className="relative">
          <div
            className="flex items-center cursor-pointer group"
            onClick={() =>
              isOwner ? setShowWorkspaceDropdown(!showWorkspaceDropdown) : null
            }
          >
            <span className="text-[#1A1A2E] font-black text-xl">
              {workspaceName || "Loading..."}
            </span>
            {isOwner && (
              <ChevronDown
                size={16}
                className={`text-[#6B6560] ml-1 transition-transform ${
                  showWorkspaceDropdown
                    ? "rotate-180 text-[#1A1A2E]"
                    : "group-hover:text-[#1A1A2E]"
                }`}
              />
            )}
          </div>

          {/* Workspace Options Dropdown */}
          {showWorkspaceDropdown && isOwner && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowWorkspaceDropdown(false)}
              ></div>
              <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-[#E8DDD0] rounded-xl shadow-xl overflow-hidden z-50 py-1">
                <button
                  onClick={() => {
                    setShowWorkspaceDropdown(false);
                    setRenameWsName(workspaceName);
                    setShowRenameModal(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-[#1A1A2E] hover:bg-[#F5EAD8] transition-colors flex items-center gap-2"
                >
                  <Edit2 size={14} className="text-[#6B6560]" />
                  Rename Workspace
                </button>
                <button
                  onClick={() => {
                    setShowWorkspaceDropdown(false);
                    setDeleteConfirmName("");
                    setShowDeleteModal(true);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <Trash2 size={14} className="text-red-500" />
                  Delete Workspace
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 ml-auto">
        {/* Search Bar - Always Outside */}
        {isCompact || isMobile ? (
          <div className="flex items-center">
            {showMobileSearch ? (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6560]"
                  />
                  <input
                    type="text"
                    placeholder="Search..."
                    autoFocus
                    className="bg-[#F5EAD8] text-[#1A1A2E] placeholder-[#6B6560] rounded-full border border-[#E8DDD0] pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#244e8a]/20 transition-all w-32 sm:w-44"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onBlur={() => {
                      if (!searchTerm) setShowMobileSearch(false);
                    }}
                  />
                </div>
                <button
                  onClick={() => setShowMobileSearch(false)}
                  className="p-2 text-[#6B6560] hover:text-[#1A1A2E] transition-colors"
                  title="Close search"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowMobileSearch(true)}
                className="w-9 h-9 flex items-center justify-center bg-[#F5EAD8] text-[#1A1A2E] rounded-lg border border-[#E8DDD0] hover:bg-white transition-all"
                title="Search"
              >
                <Search size={18} />
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6560]"
            />
            <input
              type="text"
              placeholder="Search..."
              className="bg-[#F5EAD8] text-[#1A1A2E] placeholder-[#6B6560] rounded-full border border-[#E8DDD0] pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#244e8a]/20 transition-all w-44 lg:w-56"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        {isMobile && (
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="w-9 h-9 flex items-center justify-center bg-[#F5EAD8] text-[#1A1A2E] rounded-lg border border-[#E8DDD0] hover:bg-white transition-all"
          >
            <ChevronDown
              size={18}
              className={`transition-transform duration-300 ${
                showMobileMenu ? "rotate-180" : ""
              }`}
            />
          </button>
        )}

        {(!isMobile || showMobileMenu) && (
          <div
            className={`${
              isMobile
                ? "absolute top-full right-4 mt-3 bg-white border border-[#E8DDD0] rounded-2xl shadow-xl p-6 flex flex-col items-stretch gap-4 z-[100] min-w-[240px]"
                : "flex items-center gap-4"
            }`}
          >
            <button
              onClick={() => {
                setFilesError("");
                setFilesSuccess("");
                setWorkspaceFiles([]);
                setFilesWorkspaceData(null);
                setShowFilesModal(true);
                fetchFilesWorkspaceData(selectedWorkspaceId);
                fetchWorkspaceFiles(selectedWorkspaceId);
                if (isMobile) setShowMobileMenu(false);
              }}
              className={`border border-[#E8DDD0] bg-white text-[#1A1A2E] hover:bg-[#F5EAD8] rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2 transition-colors h-9 ${
                isMobile ? "w-full justify-center" : ""
              }`}
              title={isCompact && !isMobile ? "Files" : ""}
            >
              <Folder size={16} />
              {(!isCompact || isMobile) && <span>Files</span>}
            </button>

            <button
              onClick={() => {
                setInviteError("");
                setInviteSuccess("");
                setShowMembersModal(true);
                if (isMobile) setShowMobileMenu(false);
              }}
              className={`bg-[#244e8a] text-white hover:bg-[#1d3f70] rounded-lg px-3 py-2 text-sm font-bold flex items-center gap-2 transition-colors h-9 ${
                isMobile ? "w-full justify-center" : ""
              }`}
              title={isCompact && !isMobile ? "Members" : ""}
            >
              <Users size={16} />
              {(!isCompact || isMobile) && <span>Members</span>}
            </button>

            <div className="flex items-center justify-center gap-3">
              {/* Notifications Button */}
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                  }}
                  className={`w-9 h-9 rounded-lg border border-[#E8DDD0] flex items-center justify-center transition-all ${
                    showNotifications
                      ? "bg-[#244e8a] text-white border-[#244e8a]"
                      : "bg-white text-[#1A1A2E] hover:bg-[#F5EAD8]"
                  }`}
                >
                  <div className="relative">
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                </button>

                {showNotifications && (
                  <NotificationsDropdown
                    onClose={() => setShowNotifications(false)}
                  />
                )}
              </div>

              <div
                onClick={() => navigate("/profile")}
                className="w-9 h-9 rounded-full bg-[#E8DDD0] flex items-center justify-center text-sm font-bold cursor-pointer overflow-hidden border-2 border-[#E8DDD0] hover:border-[#244e8a] transition-colors"
                title={profile?.avatar || profile?.photo || "Profile"}
              >
                {profile?.avatar || profile?.photo ? (
                  <img
                    src={profile.avatar || profile.photo}
                    alt={profile.name || user?.name}
                    className="w-full h-full object-cover"
                    onError={async () => {
                      // clear and retry once
                      setProfile((p) =>
                        p ? { ...p, avatar: null, photo: null } : p
                      );
                      try {
                        const token = localStorage.getItem("token");
                        if (!token) return;
                        const res = await api.get("/auth/me", {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        const fresh = res.data;
                        saveAuth(token, fresh);
                        setProfile(fresh);
                      } catch (e) {
                        // ignore
                      }
                    }}
                  />
                ) : (
                  <span className="text-[#1A1A2E]">
                    {(profile?.name || user?.name)
                      ?.charAt(0)
                      .toUpperCase() || "U"}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
