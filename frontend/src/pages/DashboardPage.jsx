import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, isLoggedIn, clearAuth } from "../lib/auth";
import api from "../lib/api";
import WorkspaceChat from "../components/WorkspaceChat";
import NotificationsDropdown from "../components/NotificationsDropdown";
import {
  Bell,
  Plus,
  Search,
  Users,
  ChevronDown,
  UserPlus,
  Folder,
  LayoutGrid,
  List,
  Trash2,
  Map,
  MessageSquare,
  X,
  Loader2,
  Sparkles,
  LogOut,
  Clock,
  Link as LinkIcon,
  Eye,
  Download,
  Upload,
  CheckCircle,
  Edit2,
  Menu,
} from "lucide-react";

function DashboardPage() {
  const navigate = useNavigate();
  const user = getUser();

  // Existing states
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [error, setError] = useState("");

  // New states
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("wsId") || null;
  });
  const [workspaceBoards, setWorkspaceBoards] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [inviteFocused, setInviteFocused] = useState(false);

  const [showFilesModal, setShowFilesModal] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [filesSuccess, setFilesSuccess] = useState("");
  const [filesWorkspaceData, setFilesWorkspaceData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [showAddWsModal, setShowAddWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsDescription, setNewWsDescription] = useState("");
  const [newWsEmails, setNewWsEmails] = useState("");
  const [creatingWs, setCreatingWs] = useState(false);
  const [wsCreateError, setWsCreateError] = useState("");
  const [wsCreateSuccess, setWsCreateSuccess] = useState("");

  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameWsName, setRenameWsName] = useState("");
  const [renamingWs, setRenamingWs] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deletingWs, setDeletingWs] = useState(false);

  const [showBoardRenameModal, setShowBoardRenameModal] = useState(false);
  const [renameBoardTitle, setRenameBoardTitle] = useState("");
  const [renamingBoard, setRenamingBoard] = useState(false);
  const [targetBoardId, setTargetBoardId] = useState(null);

  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsRef = useRef(null);

  // Responsiveness
  const [isCompact, setIsCompact] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      // If width is less than half of full screen (usually 1920/2 = 960)
      setIsCompact(width < 960 && width >= 768);

      if (width < 768) {
        setShowSidebar(false);
      } else {
        setShowSidebar(true);
      }
    };

    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  // Auth check
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login");
    }
  }, [navigate]);

  // Existing fetch logic
  const fetchWorkspaces = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoadingWorkspaces(false);
      return;
    }

    setError("");
    setLoadingWorkspaces(true);
    try {
      const res = await api.get("/workspaces/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const wsData = Array.isArray(res.data) ? res.data : [];
      setWorkspaces(wsData);

      const params = new URLSearchParams(window.location.search);
      const urlWsId = params.get("wsId");

      if (wsData.length > 0 && !selectedWorkspaceId) {
        if (urlWsId) {
          setSelectedWorkspaceId(urlWsId);
        } else {
          setSelectedWorkspaceId(wsData[0]._id);
        }
      }
    } catch (err) {
      setError("Failed to load workspaces.");
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Fetch boards and workspace info when selected workspace changes
  useEffect(() => {
    if (!selectedWorkspaceId) return;

    const fetchWorkspaceData = async () => {
      const token = localStorage.getItem("token");
      setLoadingBoards(true);
      try {
        const [wsRes, boardsRes] = await Promise.all([
          api.get(`/workspaces/${selectedWorkspaceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          api.get(`/boards/workspace/${selectedWorkspaceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setWorkspaceName(wsRes.data.name);
        setWorkspaceMembers(Array.isArray(wsRes.data.members) ? wsRes.data.members : []);
        setWorkspaceBoards(Array.isArray(boardsRes.data) ? boardsRes.data : []);
      } catch (err) {
        console.error("Failed to fetch workspace data", err);
      } finally {
        setLoadingBoards(false);
      }
    };

    fetchWorkspaceData();

    // Auto-refresh board data to show active users
    const interval = setInterval(fetchWorkspaceData, 10000);
    return () => clearInterval(interval);
  }, [selectedWorkspaceId]);

  // Handle Google Drive OAuth Redirect or deep links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const openedFilesModal = params.get("openedFilesModal");
    const wsId = params.get("wsId");

    // If we have a wsId in the URL, make sure it's selected
    if (wsId && wsId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(wsId);
    }

    if (openedFilesModal === "true") {
      setShowFilesModal(true);
      const targetId = wsId || selectedWorkspaceId;
      if (targetId) {
        fetchFilesWorkspaceData(targetId);
        fetchWorkspaceFiles(targetId);
      }

      if (status === "success") {
        setFilesSuccess("Google Drive connected successfully!");
        setTimeout(() => setFilesSuccess(""), 5000);
      } else if (status === "error") {
        setFilesError(params.get("message") || "Failed to connect Google Drive.");
      }
    }

    // Clean up URL if we had params
    if (openedFilesModal || wsId) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [selectedWorkspaceId]);

  // Autocomplete for inviting members
  useEffect(() => {
    const clean = inviteEmail.trim();
    if (clean.length < 2) {
      setSuggestedUsers([]);
      return;
    }

    const timer = setTimeout(async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await api.get(`/users?q=${encodeURIComponent(clean)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuggestedUsers(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Autocomplete error:", e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inviteEmail]);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const handleCreateBoard = async () => {
    if (!selectedWorkspaceId) return;
    const token = localStorage.getItem("token");
    setCreating(true);
    try {
      const res = await api.post(
        "/boards",
        { workspaceId: selectedWorkspaceId, title: "New Board" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/workspaces/${selectedWorkspaceId}/boards/${res.data._id}`);
    } catch (err) {
      console.error("Failed to create board", err);
    } finally {
      setCreating(false);
    }
  };
  const handleDeleteBoard = async (boardId) => {
    const token = localStorage.getItem("token");
    try {
      await api.delete(`/boards/${boardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWorkspaceBoards((prev) => prev.filter((b) => b._id !== boardId));
    } catch (err) {
      console.error("Failed to delete board", err);
    }
  };

  const handleRenameBoard = async (e) => {
    if (e) e.preventDefault();
    if (!renameBoardTitle.trim() || !targetBoardId) return;

    const token = localStorage.getItem("token");
    setRenamingBoard(true);
    try {
      await api.patch(
        `/boards/${targetBoardId}`,
        { title: renameBoardTitle },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkspaceBoards(prev => prev.map(b => b._id === targetBoardId ? { ...b, title: renameBoardTitle } : b));
      setShowBoardRenameModal(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to rename board.");
    } finally {
      setRenamingBoard(false);
    }
  };

  // Fetch notifications count
  const fetchUnreadCount = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const [resInvites, resNotes] = await Promise.all([
        api.get("/invitations/my", { headers: { Authorization: `Bearer ${token}` } }),
        api.get("/notifications", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const invitesCount = Array.isArray(resInvites.data) ? resInvites.data.length : 0;
      const unreadNotesCount = Array.isArray(resNotes.data) ? resNotes.data.filter(n => !n.isRead).length : 0;
      setUnreadCount(invitesCount + unreadNotesCount);
    } catch (e) {
      console.error("Failed to fetch unread count", e);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    const token = localStorage.getItem("token");
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");
    try {
      await api.post(
        `/workspaces/${selectedWorkspaceId}/invite`,
        { memberEmails: [inviteEmail.trim()] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
    } catch (e) {
      setInviteError(e?.response?.data?.message || "Failed to send invite.");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    const token = localStorage.getItem("token");
    try {
      await api.patch(
        `/workspaces/${selectedWorkspaceId}/members/${memberId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkspaceMembers(prev =>
        prev.map(m => String(m._id) === String(memberId) ? { ...m, role: newRole } : m)
      );
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to update role.");
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm("Remove this member from the workspace?")) return;
    const token = localStorage.getItem("token");
    try {
      await api.delete(
        `/workspaces/${selectedWorkspaceId}/members/${memberId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkspaceMembers(prev => prev.filter(m => String(m._id) !== String(memberId)));
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to remove member.");
    }
  };

  const myRole = workspaceMembers.find(m => String(m._id) === String(getUser()?.id))?.role || "viewer";
  const handleCreateWorkspace = async (e) => {
    if (e) e.preventDefault();
    if (!newWsName.trim()) {
      setWsCreateError("Workspace name is required.");
      return;
    }

    const token = localStorage.getItem("token");
    setCreatingWs(true);
    setWsCreateError("");
    setWsCreateSuccess("");

    const memberEmails = newWsEmails
      .split(",")
      .map((em) => em.trim())
      .filter((em) => em.length > 0);

    try {
      await api.post(
        "/workspaces",
        { name: newWsName, description: newWsDescription, memberEmails },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setWsCreateSuccess("Workspace created successfully!");
      setNewWsName("");
      setNewWsDescription("");
      setNewWsEmails("");

      // Refresh list
      await fetchWorkspaces();

      setTimeout(() => {
        setWsCreateSuccess("");
        setShowAddWsModal(false);
      }, 1500);
    } catch (err) {
      setWsCreateError(err.response?.data?.message || "Failed to create workspace.");
    } finally {
      setCreatingWs(false);
    }
  };

  const isOwner = myRole === "owner";

  const handleRenameWorkspace = async (e) => {
    if (e) e.preventDefault();
    if (!renameWsName.trim() || !selectedWorkspaceId) return;

    const token = localStorage.getItem("token");
    setRenamingWs(true);
    try {
      await api.patch(
        `/workspaces/${selectedWorkspaceId}`,
        { name: renameWsName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkspaceName(renameWsName);
      setWorkspaces(prev => prev.map(w => w._id === selectedWorkspaceId ? { ...w, name: renameWsName } : w));
      setShowRenameModal(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to rename workspace.");
    } finally {
      setRenamingWs(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!selectedWorkspaceId) return;
    if (deleteConfirmName !== workspaceName) return;

    const token = localStorage.getItem("token");
    setDeletingWs(true);
    try {
      await api.delete(`/workspaces/${selectedWorkspaceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkspaces(prev => prev.filter(w => w._id !== selectedWorkspaceId));
      setSelectedWorkspaceId(null);
      setShowDeleteModal(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete workspace.");
    } finally {
      setDeletingWs(false);
    }
  };

  // Derived values for Files Modal
  const isDriveConnected = !!filesWorkspaceData?.googleDriveFolderId;
  const isFilesOwner = filesWorkspaceData?.owner?._id === user?.id;

  const fetchFilesWorkspaceData = async (wsId) => {
    if (!wsId) return;
    const token = localStorage.getItem("token");
    try {
      const res = await api.get(`/workspaces/${wsId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFilesWorkspaceData(res.data);
    } catch (e) {
      console.error("Failed to fetch files workspace data", e);
    }
  };

  const fetchWorkspaceFiles = async (wsId) => {
    if (!wsId) return;
    const token = localStorage.getItem("token");
    setFilesLoading(true);
    setFilesError("");
    try {
      const res = await api.get(`/drive/workspace/${wsId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWorkspaceFiles(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setFilesError(e?.response?.data?.message || "Could not load files.");
    } finally {
      setFilesLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem("token");
    setUploading(true);
    setFilesError("");
    setFilesSuccess("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspaceId", selectedWorkspaceId);
      await api.post("/drive/upload", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFilesSuccess("File uploaded successfully!");
      fetchWorkspaceFiles(selectedWorkspaceId);
      setTimeout(() => setFilesSuccess(""), 3000);
    } catch (e) {
      setFilesError(e?.response?.data?.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileDelete = async (fileId) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    const token = localStorage.getItem("token");
    try {
      await api.delete(`/drive/${fileId}?workspaceId=${selectedWorkspaceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWorkspaceFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to delete file.");
    }
  };

  const handleConnectDrive = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await api.get(`/drive/auth-url/${selectedWorkspaceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      window.location.href = res.data.url;
    } catch (e) {
      alert("Could not get Drive auth URL.");
    }
  };

  const getFileIcon = (mimeType = "") => {
    if (mimeType.includes("image")) return "🖼️";
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📑";
    if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
    if (mimeType.includes("video")) return "🎬";
    if (mimeType.includes("audio")) return "🎵";
    if (mimeType.includes("zip") || mimeType.includes("rar")) return "🗜️";
    return "📁";
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const filteredBoards = workspaceBoards.filter((b) =>
    b.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    <div className="w-screen h-screen flex overflow-hidden bg-[#F5EAD8] font-sans">
      {/* Mobile Overlay */}
      {isMobile && showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-[45]"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside className={`bg-white border-r border-[#E8DDD0] flex flex-col py-6 px-4 shrink-0 transition-all duration-300 
        ${isMobile ? "fixed h-full z-50 boxShadow-xl" : "relative z-10"} 
        ${!showSidebar && isMobile ? "-translate-x-full" : "translate-x-0"}
        ${isCompact ? "w-20" : "w-64"}
        ${isMobile ? "w-64" : ""}`}>
        <div className={`flex items-center gap-3 px-2 mb-8 ${isCompact ? "justify-center" : ""}`}>
          <div className="w-8 h-8 bg-[#244e8a] rounded-lg flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          {!isCompact && <span className="font-black text-[#1A1A2E] text-lg tracking-tight font-display">FusionBoard</span>}
        </div>

        {!isCompact && <p className="text-xs font-bold text-[#6B6560] uppercase tracking-widest px-2 mb-2">Workspaces</p>}

        <div className="space-y-1">
          {workspaces.map((ws) => (
            <div
              key={ws._id}
              onClick={() => setSelectedWorkspaceId(ws._id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition mb-1 ${selectedWorkspaceId === ws._id
                ? "bg-[#F5EAD8] border-l-4 border-[#1A1A2E] font-bold text-[#1A1A2E]"
                : "text-[#6B6560] hover:bg-[#F5EAD8] hover:text-[#1A1A2E] border-l-4 border-transparent"
                } ${isCompact ? "justify-center" : ""}`}
              title={isCompact ? ws.name : ""}
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: wsColor(ws._id) }}>
                {ws.name.substring(0, 2).toUpperCase()}
              </div>
              {!isCompact && <span className="text-sm truncate">{ws.name}</span>}
            </div>
          ))}
        </div>

        <button onClick={() => { setWsCreateError(""); setWsCreateSuccess(""); setShowAddWsModal(true); }}
          className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-[#6B6560] hover:bg-[#F5EAD8] hover:text-[#1A1A2E] transition mt-1 border-l-4 border-transparent ${isCompact ? "justify-center" : ""}`}
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
              <p className="text-xs font-bold text-[#1A1A2E] mb-1 font-display">Pro Plan</p>
              <p className="text-xs text-[#6B6560] mb-3">Get unlimited boards and collaborators.</p>
              <button className="w-full bg-[#1A1A2E] text-white text-xs font-bold py-2 rounded-lg hover:bg-[#2d2d4e] transition">Upgrade</button>
            </div>
          )}
          <button onClick={handleLogout} className={`flex items-center gap-3 px-3 py-2 w-full rounded-lg text-[#6B6560] hover:bg-[#F5EAD8] transition ${isCompact ? "justify-center" : ""}`}>
            <LogOut size={16} />
            {!isCompact && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Top Bar */}
        <header className="bg-white border-b border-[#E8DDD0] px-4 md:px-8 py-4 flex items-center justify-between shrink-0 relative">
          <div className="flex items-center gap-4">
            {isMobile && (
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-2 -ml-1 text-[#1A1A2E] hover:bg-[#F5EAD8] rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
            )}
            <div className="relative">
              <div
                className="flex items-center cursor-pointer group"
                onClick={() => isOwner ? setShowWorkspaceDropdown(!showWorkspaceDropdown) : null}
              >
                <span className="text-[#1A1A2E] font-black text-xl">
                  {workspaceName || "Loading..."}
                </span>
                {isOwner && (
                  <ChevronDown size={16} className={`text-[#6B6560] ml-1 transition-transform ${showWorkspaceDropdown ? "rotate-180 text-[#1A1A2E]" : "group-hover:text-[#1A1A2E]"}`} />
                )}
              </div>

              {/* Workspace Options Dropdown */}
              {showWorkspaceDropdown && isOwner && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowWorkspaceDropdown(false)}></div>
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
                <ChevronDown size={18} className={`transition-transform duration-300 ${showMobileMenu ? "rotate-180" : ""}`} />
              </button>
            )}

            {(!isMobile || showMobileMenu) && (
              <div className={`${isMobile ? "absolute top-full right-4 mt-3 bg-white border border-[#E8DDD0] rounded-2xl shadow-xl p-6 flex flex-col items-stretch gap-4 z-[100] min-w-[240px]" : "flex items-center gap-4"}`}>

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
                  className={`border border-[#E8DDD0] bg-white text-[#1A1A2E] hover:bg-[#F5EAD8] rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2 transition-colors h-9 ${isMobile ? "w-full justify-center" : ""}`}
                  title={(isCompact && !isMobile) ? "Files" : ""}
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
                  className={`bg-[#244e8a] text-white hover:bg-[#1d3f70] rounded-lg px-3 py-2 text-sm font-bold flex items-center gap-2 transition-colors h-9 ${isMobile ? "w-full justify-center" : ""}`}
                  title={(isCompact && !isMobile) ? "Members" : ""}
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
                      className={`w-9 h-9 rounded-lg border border-[#E8DDD0] flex items-center justify-center transition-all ${showNotifications ? "bg-[#244e8a] text-white border-[#244e8a]" : "bg-white text-[#1A1A2E] hover:bg-[#F5EAD8]"}`}
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
                  >
                    {user?.photo ? (
                      <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[#1A1A2E]">{user?.name?.charAt(0).toUpperCase() || "U"}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Boards Area */}
          <main className={`flex-1 overflow-y-auto ${isMobile ? "px-4" : "px-10"} py-8 bg-[#F5EAD8]`}>
            <div className="max-w-5xl mx-auto w-full">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-[#1A1A2E] font-display">Boards</h1>
                  <p className="text-sm text-[#6B6560] mt-1">Manage visual projects</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 transition-colors ${viewMode === "grid" ? "text-[#1A1A2E] bg-white border border-[#E8DDD0] rounded-lg" : "text-[#6B6560] hover:text-[#1A1A2E] hover:bg-white rounded-lg"}`}
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 transition-colors ${viewMode === "list" ? "text-[#1A1A2E] bg-white border border-[#E8DDD0] rounded-lg" : "text-[#6B6560] hover:text-[#1A1A2E] hover:bg-white rounded-lg"}`}
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>

              {viewMode === "grid" && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                  {/* New Board Card */}
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
                        <span className="text-white font-semibold text-sm mt-2 font-display">New Board</span>
                      </>
                    )}
                  </div>

                  {loadingBoards ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="bg-[#EDE3D5] animate-pulse rounded-2xl h-[190px]" />
                    ))
                  ) : filteredBoards.length === 0 && !loadingWorkspaces ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-center h-[180px]">
                      <Map size={56} className="text-[#C8BDB5] mb-4" />
                      <h3 className="text-lg font-semibold text-[#1A1A2E]">No boards yet</h3>
                      <p className="text-[#6B6560] max-w-xs">Create your first board to get started with your projects.</p>
                    </div>
                  ) : (
                    filteredBoards.map((b) => (
                      <div
                        key={b._id}
                        onClick={() => navigate(`/workspaces/${selectedWorkspaceId}/boards/${b._id}`)}
                        className="bg-white border border-[#E8DDD0] rounded-2xl cursor-pointer hover:border-[#244e8a] hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col group relative overflow-hidden h-[190px]"
                      >
                        {/* Preview Area */}
                        <div className="flex-1 min-h-0 relative flex items-center justify-center p-6">
                          <svg width="80" height="60" viewBox="0 0 80 60" className="opacity-40">
                            <rect x="5" y="5" width="70" height="50" rx="4" stroke="#6AB5B8" strokeWidth="2" fill="none" />
                            <rect x="15" y="15" width="30" height="20" rx="2" fill="#6AB5B8" />
                            <circle cx="55" cy="25" r="8" fill="#6AB5B8" />
                            <rect x="15" y="40" width="50" height="4" rx="2" fill="#6AB5B8" />
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
                                <div key={idx} className="w-5 h-5 rounded-full border-2 border-white bg-[#E8DDD0] overflow-hidden" title={u.name}>
                                  {u.avatar ? (
                                    <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#244e8a] text-white text-[8px] font-black uppercase">
                                      {u.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {b.activeUsers?.length > 3 && (
                                <div className="w-5 h-5 rounded-full border-2 border-white bg-[#F5EAD8] text-[8px] flex items-center justify-center font-bold text-[#1A1A2E]" title="More">
                                  +{b.activeUsers.length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
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
                              if (confirm("Delete this board?")) handleDeleteBoard(b._id);
                            }}
                            className="w-8 h-8 bg-white border border-[#E8DDD0] shadow-sm rounded-full flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {viewMode === "list" && (
                <div className="mt-6 flex flex-col gap-2">
                  <div
                    onClick={handleCreateBoard}
                    className="bg-[#1A1A2E] hover:bg-[#2d2d4e] rounded-xl px-5 py-3 flex items-center gap-3 cursor-pointer transition-all"
                  >
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                      <Plus size={18} className="text-white" />
                    </div>
                    <span className="text-white font-semibold text-sm">New Board</span>
                  </div>
                  {loadingBoards ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="animate-pulse bg-[#EDE3D5] rounded-xl h-14" />
                    ))
                  ) : (
                    filteredBoards.map((b) => (
                      <div
                        key={b._id}
                        onClick={() => navigate(`/workspaces/${selectedWorkspaceId}/boards/${b._id}`)}
                        className="bg-white border border-[#E8DDD0] rounded-xl px-5 py-3 flex items-center justify-between cursor-pointer hover:border-[#244e8a] hover:shadow-sm transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                            <svg width="20" height="16" viewBox="0 0 80 60" className="opacity-40">
                              <rect x="5" y="5" width="70" height="50" rx="4" stroke="#244e8a" strokeWidth="3" fill="none" />
                              <rect x="15" y="15" width="30" height="20" rx="2" fill="#244e8a" />
                              <circle cx="55" cy="25" r="8" fill="#244e8a" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#1A1A2E]">{b.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-[#6B6560]">{timeAgo(b.updatedAt)}</p>
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
                            onClick={(e) => { e.stopPropagation(); if (confirm("Delete this board?")) handleDeleteBoard(b._id); }}
                            className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center transition-all"
                          >
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </main>

        </div>
      </div>

      {/* Add Workspace Modal */}
      {showAddWsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowAddWsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-[#E8DDD0]"
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DDD0]">
              <div>
                <h2 className="font-black text-[#1A1A2E] font-display text-lg">Create Workspace</h2>
                <p className="text-xs text-[#6B6560] mt-0.5">Start a new visual project</p>
              </div>
              <button onClick={() => setShowAddWsModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#F5EAD8] flex items-center justify-center transition">
                <X size={18} className="text-[#6B6560]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest block mb-2">Workspace Name</label>
                <input
                  type="text"
                  placeholder="e.g. Design Team, Marketing"
                  value={newWsName}
                  onChange={e => setNewWsName(e.target.value)}
                  className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] placeholder-[#6B6560] outline-none focus:ring-2 focus:ring-[#244e8a]/20"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest block mb-2">Description</label>
                <textarea
                  placeholder="Short description of this workspace..."
                  value={newWsDescription}
                  onChange={e => setNewWsDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] placeholder-[#6B6560] outline-none focus:ring-2 focus:ring-[#244e8a]/20 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest block mb-2">Invite Members (Optional)</label>
                <textarea
                  placeholder="friend@email.com, colleague@email.com"
                  value={newWsEmails}
                  onChange={e => setNewWsEmails(e.target.value)}
                  rows={2}
                  className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] placeholder-[#6B6560] outline-none focus:ring-2 focus:ring-[#244e8a]/20 resize-none"
                />
                <p className="text-[10px] text-[#6B6560] mt-2 italic">Separate emails with commas.</p>
              </div>

              {wsCreateError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
                  <X size={14} className="text-red-500" />
                  <p className="text-xs text-red-600 font-medium">{wsCreateError}</p>
                </div>
              )}

              {wsCreateSuccess && (
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3">
                  <CheckCircle size={14} className="text-green-500" />
                  <p className="text-xs text-green-600 font-medium">{wsCreateSuccess}</p>
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
                {creatingWs ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Workspace Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowRenameModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-[#E8DDD0]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DDD0]">
              <h2 className="font-black text-[#1A1A2E] font-display text-lg">Rename Workspace</h2>
              <button onClick={() => setShowRenameModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#F5EAD8] flex items-center justify-center transition">
                <X size={18} className="text-[#6B6560]" />
              </button>
            </div>
            <div className="px-6 py-6 border-b border-[#E8DDD0]">
              <label className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest block mb-2">Workspace Name</label>
              <input
                type="text"
                value={renameWsName}
                onChange={e => setRenameWsName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRenameWorkspace()}
                className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] outline-none focus:ring-2 focus:ring-[#244e8a]/20"
              />
            </div>
            <div className="px-6 py-4 bg-[#F5EAD8]/30 flex justify-end gap-3">
              <button
                onClick={() => setShowRenameModal(false)}
                className="text-[#6B6560] hover:text-[#1A1A2E] text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameWorkspace}
                disabled={renamingWs || !renameWsName.trim() || renameWsName === workspaceName}
                className="bg-[#244e8a] text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-[#1d3f70] transition disabled:opacity-50 flex items-center gap-2"
              >
                {renamingWs ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Workspace Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-[#E8DDD0]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DDD0]">
              <h2 className="font-black text-red-600 font-display text-lg">Delete Workspace</h2>
              <button onClick={() => setShowDeleteModal(false)}
                className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center transition">
                <X size={18} className="text-[#6B6560] hover:text-red-500" />
              </button>
            </div>
            <div className="px-6 py-6 border-b border-[#E8DDD0] space-y-4">
              <p className="text-sm text-[#1A1A2E]">
                This action <span className="font-bold">cannot</span> be undone. This will permanently delete the
                <span className="font-bold"> {workspaceName} </span> workspace, all of its boards, and remove all members.
              </p>
              <div>
                <label className="text-xs font-bold text-[#1A1A2E] block mb-2">
                  Please type <span className="text-red-600 font-black">{workspaceName}</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={e => setDeleteConfirmName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && deleteConfirmName === workspaceName && handleDeleteWorkspace()}
                  className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-red-50/50 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-[#6B6560] hover:text-[#1A1A2E] text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkspace}
                disabled={deletingWs || deleteConfirmName !== workspaceName}
                className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {deletingWs ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )
      }


      {/* Rename Board Modal */}
      {showBoardRenameModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowBoardRenameModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-[#E8DDD0]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DDD0]">
              <h2 className="font-black text-[#1A1A2E] font-display text-lg">Rename Board</h2>
              <button onClick={() => setShowBoardRenameModal(false)}
                className="w-8 h-8 rounded-full hover:bg-[#F5EAD8] flex items-center justify-center transition">
                <X size={18} className="text-[#6B6560]" />
              </button>
            </div>
            <div className="px-6 py-6 border-b border-[#E8DDD0]">
              <label className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest block mb-2">Board Title</label>
              <input
                autoFocus
                type="text"
                value={renameBoardTitle}
                onChange={e => setRenameBoardTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRenameBoard()}
                className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] outline-none focus:ring-2 focus:ring-[#244e8a]/20"
              />
            </div>
            <div className="px-6 py-4 bg-[#F5EAD8]/30 flex justify-end gap-3">
              <button
                onClick={() => setShowBoardRenameModal(false)}
                className="text-[#6B6560] hover:text-[#1A1A2E] text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameBoard}
                disabled={renamingBoard || !renameBoardTitle.trim()}
                className="bg-[#244e8a] text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-[#1d3f70] transition disabled:opacity-50 flex items-center gap-2"
              >
                {renamingBoard ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {
        showMembersModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShowMembersModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-[#E8DDD0]"
              onClick={e => e.stopPropagation()}>

              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DDD0]">
                <div>
                  <h2 className="font-black text-[#1A1A2E] font-display text-lg">Members</h2>
                  <p className="text-xs text-[#6B6560] mt-0.5">{workspaceName}</p>
                </div>
                <button onClick={() => setShowMembersModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-[#F5EAD8] flex items-center justify-center transition">
                  <X size={18} className="text-[#6B6560]" />
                </button>
              </div>

              {/* Invite Input */}
              <div className="px-6 py-4 border-b border-[#E8DDD0] bg-[#F5EAD8]/50 relative">
                <p className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest mb-2">Invite by email</p>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="email"
                      placeholder="colleague@email.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleInvite()}
                      onFocus={() => setInviteFocused(true)}
                      onBlur={() => { setInviteFocused(false); setSuggestedUsers([]); }}
                      className="w-full bg-white border border-[#E8DDD0] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] placeholder-[#6B6560] outline-none focus:ring-2 focus:ring-[#244e8a]/20"
                    />
                    {/* Autocomplete Dropdown */}
                    {suggestedUsers.length > 0 && inviteFocused && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E8DDD0] rounded-xl shadow-xl overflow-hidden z-[70]">
                        {suggestedUsers.map(u => (
                          <div
                            key={u._id}
                            onMouseDown={() => {
                              setInviteEmail(u.email);
                              setSuggestedUsers([]);
                            }}
                            className="px-4 py-2 hover:bg-[#F5EAD8] cursor-pointer flex flex-col transition-colors border-b border-[#E8DDD0] last:border-b-0"
                          >
                            <span className="text-sm font-bold text-[#1A1A2E]">{u.name}</span>
                            <span className="text-xs text-[#6B6560]">{u.email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={handleInvite} disabled={inviting}
                    className="bg-[#244e8a] text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-[#1d3f70] transition disabled:opacity-50 flex items-center gap-2 h-[38px] shrink-0">
                    {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    Invite
                  </button>
                </div>
                {inviteError && <p className="text-xs text-red-500 mt-2">{inviteError}</p>}
                {inviteSuccess && <p className="text-xs text-green-600 mt-2">{inviteSuccess}</p>}
              </div>

              {/* Members List */}
              <div className="px-6 py-4 max-h-80 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-[#1A1A2E] uppercase tracking-widest">
                    Current members ({workspaceMembers.length})
                  </p>
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B6560]" />
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={memberSearchTerm}
                      onChange={e => setMemberSearchTerm(e.target.value)}
                      className="bg-[#F5EAD8] text-xs border border-[#E8DDD0] rounded-full pl-8 pr-3 py-1.5 w-40 outline-none focus:ring-2 focus:ring-[#244e8a]/20 text-[#1A1A2E] placeholder-[#6B6560]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  {workspaceMembers
                    .filter(m =>
                      (m.name || "").toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                      (m.email || "").toLowerCase().includes(memberSearchTerm.toLowerCase())
                    )
                    .map(m => (
                      <div key={m._id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[#F5EAD8] transition group">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ backgroundColor: wsColor(m._id) }}>
                            {(m.name || m.email || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#1A1A2E]">{m.name || "Unknown"}</p>
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
                                className={`text-[10px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all shadow-sm ${m.role === "owner" ? "bg-[#244e8a] text-white hover:bg-[#1e3e6e]" :
                                  m.role === "editor" ? "bg-[#FFD93D] text-[#1A1A2E] hover:bg-[#e6c437]" :
                                    "bg-[#E8DDD0] text-[#6B6560] hover:bg-[#d8cdc0]"
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
                                    className={`flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold rounded-lg ${m.role === "viewer" ? "bg-[#E8DDD0]/30 text-[#6B6560]" : "text-[#6B6560] hover:bg-neutral-50"}`}
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#E8DDD0]" />
                                    VIEWER
                                  </button>
                                </li>
                                <li>
                                  <button
                                    onClick={() => handleRoleChange(m._id, "editor")}
                                    className={`flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold rounded-lg ${m.role === "editor" ? "bg-[#FFD93D]/20 text-[#1A1A2E]" : "text-[#1A1A2E] hover:bg-neutral-50"}`}
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#FFD93D]" />
                                    EDITOR
                                  </button>
                                </li>
                                <li>
                                  <button
                                    onClick={() => handleRoleChange(m._id, "owner")}
                                    className={`flex items-center gap-2 px-3 py-2 text-[10px] font-extrabold rounded-lg ${m.role === "owner" ? "bg-[#244e8a]/10 text-[#244e8a]" : "text-[#244e8a] hover:bg-neutral-50"}`}
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#244e8a]" />
                                    OWNER
                                  </button>
                                </li>
                              </ul>
                            </div>
                          ) : (
                            <span className={`text-[10px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-full shadow-sm ${m.role === "owner" ? "bg-[#244e8a] text-white" :
                              m.role === "editor" ? "bg-[#FFD93D] text-[#1A1A2E]" :
                                "bg-[#E8DDD0] text-[#6B6560]"
                              }`}>
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
        )
      }

      {
        showFilesModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-md transition-all duration-300"
            onClick={() => setShowFilesModal(false)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-[#E8DDD0] animate-in fade-in zoom-in duration-200"
              onClick={e => e.stopPropagation()}>

              {/* Section 1: Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-[#E8DDD0] bg-white">
                <div>
                  <h2 className="font-black text-[#1A1A2E] text-2xl tracking-tight leading-none">Files</h2>
                  <p className="text-xs font-semibold text-[#6B6560] mt-1 tracking-wide uppercase">{workspaceName}</p>
                </div>
                <button onClick={() => setShowFilesModal(false)}
                  className="w-10 h-10 rounded-full hover:bg-[#F5EAD8] flex items-center justify-center transition-colors group">
                  <X size={20} className="text-[#6B6560] group-hover:text-[#1A1A2E]" />
                </button>
              </div>

              {/* Section 2: Drive Connection & Upload Area */}
              <div className="px-8 py-6 border-b border-[#E8DDD0] bg-[#F5EAD8]/40">
                {filesWorkspaceData === null ? (
                  <div className="flex justify-center py-4">
                    <Loader2 size={24} className="animate-spin text-[#244e8a]" />
                  </div>
                ) : !isDriveConnected ? (
                  <div className="flex flex-col items-center gap-4 py-2 text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <LinkIcon size={20} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-[#1A1A2E] font-bold">Google Drive not connected</p>
                      <p className="text-sm text-[#6B6560] mt-1">Files for this workspace are stored securely in Google Drive.</p>
                    </div>
                    {isFilesOwner ? (
                      <button onClick={handleConnectDrive}
                        className="bg-[#244e8a] text-white rounded-xl px-6 py-2.5 text-sm font-black hover:bg-[#1d3f70] transition-all shadow-lg shadow-blue-900/10 flex items-center gap-2">
                        <LinkIcon size={16} /> Connect Google Drive
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-white/50 rounded-xl border border-[#E8DDD0]">
                        <Loader2 size={14} className="animate-spin text-[#6B6560]" />
                        <p className="text-xs text-[#6B6560] font-medium italic">Waiting for the workspace owner to connect Google Drive...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-[#1A1A2E] uppercase tracking-[0.15em]">Upload a file</p>
                      <p className="text-[10px] text-[#6B6560] font-medium mt-0.5">Max file size 50MB</p>
                    </div>
                    <div className="relative">
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        className="bg-[#244e8a] text-white rounded-xl px-6 py-2.5 text-sm font-black hover:bg-[#1d3f70] transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-900/10">
                        {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {uploading ? "Uploading..." : "Upload Button"}
                      </button>
                    </div>
                  </div>
                )}
                {filesSuccess && (
                  <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-100 rounded-xl">
                    <CheckCircle size={14} className="text-green-600" />
                    <p className="text-xs text-green-700 font-bold">{filesSuccess}</p>
                  </div>
                )}
                {filesError && (
                  <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-xl">
                    <X size={14} className="text-red-600" />
                    <p className="text-xs text-red-700 font-bold">{filesError}</p>
                  </div>
                )}
              </div>

              {/* Section 3: File List */}
              <div className="px-8 py-6 max-h-[400px] overflow-y-auto">
                <div className="flex items-center justify-between mb-4 border-b border-[#E8DDD0] pb-2">
                  <p className="text-[10px] font-black text-[#1A1A2E] uppercase tracking-[0.2em]">Files ({workspaceFiles.length})</p>
                </div>

                {filesLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 size={32} className="animate-spin text-[#244e8a]" />
                    <p className="text-xs font-bold text-[#6B6560] uppercase tracking-widest">Fetching your files...</p>
                  </div>
                ) : workspaceFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center opacity-60">
                    <Folder size={40} className="text-[#E8DDD0] mb-3" />
                    <p className="text-sm font-semibold text-[#1A1A2E]">No files uploaded yet.</p>
                    <p className="text-xs text-[#6B6560] mt-1">Connect Drive or upload a file to get started.</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {workspaceFiles.map(f => (
                      <div key={f.id} className="flex items-center justify-between py-3 px-4 rounded-2xl hover:bg-[#F5EAD8]/60 border border-transparent hover:border-[#E8DDD0] transition-all group">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white border border-[#E8DDD0] flex items-center justify-center text-xl shrink-0 shadow-sm transition-transform group-hover:scale-105">
                            {getFileIcon(f.mimeType)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#1A1A2E] truncate max-w-[280px]" title={f.name}>
                              {f.name}
                            </p>
                            <p className="text-[11px] text-[#6B6560] font-semibold flex items-center gap-1.5 mt-0.5">
                              {formatFileSize(f.size)}
                              {f.size && f.createdTime && <span className="w-1 h-1 rounded-full bg-[#E8DDD0]" />}
                              {f.createdTime ? new Date(f.createdTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          {f.webViewLink && (
                            <a href={f.webViewLink} target="_blank" rel="noreferrer"
                              className="w-9 h-9 rounded-xl border border-[#E8DDD0] bg-white hover:bg-[#244e8a] hover:text-white flex items-center justify-center transition-all shadow-sm" title="Preview">
                              <Eye size={15} />
                            </a>
                          )}
                          {f.webContentLink && (
                            <a href={f.webContentLink}
                              className="w-9 h-9 rounded-xl border border-[#E8DDD0] bg-white hover:bg-[#244e8a] hover:text-white flex items-center justify-center transition-all shadow-sm" title="Download">
                              <Download size={15} />
                            </a>
                          )}
                          <button onClick={() => handleFileDelete(f.id)}
                            className="w-9 h-9 rounded-xl border border-[#E8DDD0] bg-white hover:bg-red-500 hover:text-white flex items-center justify-center transition-all shadow-sm" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 4: Footer */}
              <div className="px-8 py-4 border-t border-[#E8DDD0] bg-[#F5EAD8]/20 flex justify-end">
                <button onClick={() => setShowFilesModal(false)}
                  className="bg-white border border-[#E8DDD0] text-[#1A1A2E] rounded-xl px-6 py-2 text-sm font-bold hover:bg-[#F5EAD8] transition-all">
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Floating chat button + popup */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {showChat && selectedWorkspaceId && (
          <div className="w-[340px] h-[480px] bg-white border border-[#E8DDD0] shadow-2xl rounded-2xl flex flex-col overflow-hidden"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div className="flex items-center justify-between px-4 py-3 bg-[#1A1A2E] shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-white/70" />
                <span className="text-white font-semibold text-sm">Team Chat</span>
              </div>
              <X size={16} className="text-white/60 cursor-pointer hover:text-white" onClick={() => setShowChat(false)} />
            </div>
            <div className="flex-1 overflow-hidden">
              <WorkspaceChat workspaceId={selectedWorkspaceId} />
            </div>
          </div>
        )}
        <button
          onClick={() => setShowChat(!showChat)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all ${showChat ? "bg-red-500" : "bg-[#244e8a] hover:bg-[#1d3f70]"}`}
        >
          {showChat ? <X size={22} className="text-white" /> : <MessageSquare size={22} className="text-white" />}
        </button>
      </div>
    </div >
  );
}

export default DashboardPage;
