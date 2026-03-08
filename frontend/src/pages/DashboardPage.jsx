import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, isLoggedIn, clearAuth, saveAuth } from "../lib/auth";
import api from "../lib/api";

// Hooks
import { useWorkspaces } from "../hooks/useWorkspaces";
import { useBoards } from "../hooks/useBoards";
import { useFiles } from "../hooks/useFiles";
import { useNotifications } from "../hooks/useNotifications";

// Components
import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import BoardsGrid from "../components/dashboard/BoardsGrid";
import FloatingChat from "../components/dashboard/FloatingChat";

// Modals
import CreateWorkspaceModal from "../components/dashboard/modals/CreateWorkspaceModal";
import RenameWorkspaceModal from "../components/dashboard/modals/RenameWorkspaceModal";
import DeleteWorkspaceModal from "../components/dashboard/modals/DeleteWorkspaceModal";
import RenameBoardModal from "../components/dashboard/modals/RenameBoardModal";
import MembersModal from "../components/dashboard/modals/MembersModal";
import FilesModal from "../components/dashboard/modals/FilesModal";

function DashboardPage() {
  const navigate = useNavigate();
  const user = getUser();
  const [profile, setProfile] = useState(user);

  // Local UI State
  const [viewMode, setViewMode] = useState("grid");
  const [showChat, setShowChat] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);

  // Modal Visibility State
  const [showAddWsModal, setShowAddWsModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [showBoardRenameModal, setShowBoardRenameModal] = useState(false);

  // Modal Input State
  const [newWsName, setNewWsName] = useState("");
  const [newWsDescription, setNewWsDescription] = useState("");
  const [newWsEmails, setNewWsEmails] = useState("");
  const [renameWsName, setRenameWsName] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");

  // Custom Hooks
  const workspaceData = useWorkspaces();
  const boardData = useBoards(workspaceData.selectedWorkspaceId);
  const fileData = useFiles(workspaceData.selectedWorkspaceId, setShowFilesModal);
  const notificationData = useNotifications();

  // Auth & Profile Check
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login");
      return;
    }

    const loadProfile = async () => {
      try {
        if (profile && (profile.avatar || profile.photo)) return;
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const fresh = res.data;
        saveAuth(token, fresh);
        setProfile(fresh);
      } catch {
        // ignore
      }
    };
    loadProfile();
  }, [navigate, profile]);

  // Responsiveness
  useEffect(() => {
    const checkSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsCompact(width < 960 && width >= 768);
      if (width < 768) setShowSidebar(false);
      else setShowSidebar(true);
    };
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

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
    for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
    return colors[sum % colors.length];
  };

  const filteredBoards = boardData.workspaceBoards.filter((b) =>
    b.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-[#F5EAD8] font-sans">
      <Sidebar
        isMobile={isMobile}
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
        isCompact={isCompact}
        workspaces={workspaceData.workspaces}
        selectedWorkspaceId={workspaceData.selectedWorkspaceId}
        navigate={navigate}
        handleLogout={handleLogout}
        setShowAddWsModal={setShowAddWsModal}
        setWsCreateError={workspaceData.setWsCreateError}
        setWsCreateSuccess={workspaceData.setWsCreateSuccess}
      />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <DashboardHeader
          isMobile={isMobile}
          showSidebar={showSidebar}
          setShowSidebar={setShowSidebar}
          workspaceName={workspaceData.workspaceName}
          isOwner={workspaceData.isOwner}
          showWorkspaceDropdown={showWorkspaceDropdown}
          setShowWorkspaceDropdown={setShowWorkspaceDropdown}
          setRenameWsName={setRenameWsName}
          setShowRenameModal={setShowRenameModal}
          setDeleteConfirmName={setDeleteConfirmName}
          setShowDeleteModal={setShowDeleteModal}
          isCompact={isCompact}
          showMobileSearch={showMobileSearch}
          setShowMobileSearch={setShowMobileSearch}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          showMobileMenu={showMobileMenu}
          setShowMobileMenu={setShowMobileMenu}
          setFilesError={fileData.setFilesError}
          setFilesSuccess={fileData.setFilesSuccess}
          setWorkspaceFiles={fileData.setWorkspaceFiles}
          setFilesWorkspaceData={fileData.setFilesWorkspaceData}
          setShowFilesModal={setShowFilesModal}
          fetchFilesWorkspaceData={fileData.fetchFilesWorkspaceData}
          fetchWorkspaceFiles={fileData.fetchWorkspaceFiles}
          selectedWorkspaceId={workspaceData.selectedWorkspaceId}
          setInviteError={workspaceData.setInviteError}
          setInviteSuccess={workspaceData.setInviteSuccess}
          setShowMembersModal={setShowMembersModal}
          notificationsRef={notificationData.notificationsRef}
          showNotifications={notificationData.showNotifications}
          setShowNotifications={notificationData.setShowNotifications}
          unreadCount={notificationData.unreadCount}
          navigate={navigate}
          profile={profile}
          setProfile={setProfile}
          user={user}
        />

        <div className="flex-1 flex overflow-hidden">
          <main
            className={`flex-1 overflow-y-auto ${
              isMobile ? "px-4" : "px-10"
            } py-8 bg-[#F5EAD8]`}
          >
            <div className="max-w-5xl mx-auto w-full">
              <BoardsGrid
                viewMode={viewMode}
                setViewMode={setViewMode}
                handleCreateBoard={boardData.handleCreateBoard}
                creating={boardData.creating}
                loadingBoards={boardData.loadingBoards}
                filteredBoards={filteredBoards}
                navigate={navigate}
                selectedWorkspaceId={workspaceData.selectedWorkspaceId}
                loadingWorkspaces={workspaceData.loadingWorkspaces}
                setTargetBoardId={boardData.setTargetBoardId}
                setRenameBoardTitle={boardData.setRenameBoardTitle}
                setShowBoardRenameModal={setShowBoardRenameModal}
                handleDeleteBoard={boardData.handleDeleteBoard}
              />
            </div>
          </main>
        </div>
      </div>

      <CreateWorkspaceModal
        isOpen={showAddWsModal}
        onClose={() => setShowAddWsModal(false)}
        newWsName={newWsName}
        setNewWsName={setNewWsName}
        newWsDescription={newWsDescription}
        setNewWsDescription={setNewWsDescription}
        newWsEmails={newWsEmails}
        setNewWsEmails={setNewWsEmails}
        creatingWs={workspaceData.creatingWs}
        wsCreateError={workspaceData.wsCreateError}
        wsCreateSuccess={workspaceData.wsCreateSuccess}
        handleCreateWorkspace={(e) =>
          workspaceData.handleCreateWorkspace(
            e,
            newWsName,
            newWsDescription,
            newWsEmails,
            setShowAddWsModal,
            setNewWsName,
            setNewWsDescription,
            setNewWsEmails
          )
        }
      />

      <RenameWorkspaceModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        renameWsName={renameWsName}
        setRenameWsName={setRenameWsName}
        handleRenameWorkspace={() =>
          workspaceData.handleRenameWorkspace(renameWsName, setShowRenameModal)
        }
        renamingWs={workspaceData.renamingWs}
        workspaceName={workspaceData.workspaceName}
      />

      <DeleteWorkspaceModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        workspaceName={workspaceData.workspaceName}
        deleteConfirmName={deleteConfirmName}
        setDeleteConfirmName={setDeleteConfirmName}
        handleDeleteWorkspace={() =>
          workspaceData.handleDeleteWorkspace(
            deleteConfirmName,
            setShowDeleteModal
          )
        }
        deletingWs={workspaceData.deletingWs}
      />

      <RenameBoardModal
        isOpen={showBoardRenameModal}
        onClose={() => setShowBoardRenameModal(false)}
        renameBoardTitle={boardData.renameBoardTitle}
        setRenameBoardTitle={boardData.setRenameBoardTitle}
        handleRenameBoard={() =>
          boardData.handleRenameBoard(setShowBoardRenameModal)
        }
        renamingBoard={boardData.renamingBoard}
      />

      <MembersModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        workspaceName={workspaceData.workspaceName}
        inviteEmail={workspaceData.inviteEmail}
        setInviteEmail={workspaceData.setInviteEmail}
        handleInvite={workspaceData.handleInvite}
        inviting={workspaceData.inviting}
        inviteError={workspaceData.inviteError}
        inviteSuccess={workspaceData.inviteSuccess}
        inviteFocused={workspaceData.inviteFocused}
        setInviteFocused={workspaceData.setInviteFocused}
        suggestedUsers={workspaceData.suggestedUsers}
        setSuggestedUsers={workspaceData.setSuggestedUsers}
        memberSearchTerm={memberSearchTerm}
        setMemberSearchTerm={setMemberSearchTerm}
        workspaceMembers={workspaceData.workspaceMembers}
        wsColor={wsColor}
        handleRemoveMember={workspaceData.handleRemoveMember}
        handleRoleChange={workspaceData.handleRoleChange}
        isOwner={workspaceData.isOwner}
      />

      <FilesModal
        isOpen={showFilesModal}
        onClose={() => setShowFilesModal(false)}
        workspaceName={workspaceData.workspaceName}
        filesWorkspaceData={fileData.filesWorkspaceData}
        isDriveConnected={fileData.isDriveConnected}
        isFilesOwner={fileData.isFilesOwner}
        handleConnectDrive={fileData.handleConnectDrive}
        fileInputRef={fileData.fileInputRef}
        handleFileUpload={fileData.handleFileUpload}
        uploading={fileData.uploading}
        filesSuccess={fileData.filesSuccess}
        filesError={fileData.filesError}
        filesLoading={fileData.filesLoading}
        workspaceFiles={fileData.workspaceFiles}
        getFileIcon={fileData.getFileIcon}
        formatFileSize={fileData.formatFileSize}
        handleFileDelete={fileData.handleFileDelete}
      />

      <FloatingChat
        showChat={showChat}
        setShowChat={setShowChat}
        selectedWorkspaceId={workspaceData.selectedWorkspaceId}
      />
    </div>
  );
}

export default DashboardPage;
