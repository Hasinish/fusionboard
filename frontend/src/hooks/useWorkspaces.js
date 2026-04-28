import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import api, { API_URL } from "../lib/api";
import { getUser } from "../lib/auth";

export function useWorkspaces() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = getUser();

  // Workspace List State
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [error, setError] = useState("");

  // Selected Workspace State
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [refreshMembersTrigger, setRefreshMembersTrigger] = useState(0);

  // Create Workspace State
  const [creatingWs, setCreatingWs] = useState(false);
  const [wsCreateError, setWsCreateError] = useState("");
  const [wsCreateSuccess, setWsCreateSuccess] = useState("");

  // Rename Workspace State
  const [renamingWs, setRenamingWs] = useState(false);

  // Delete Workspace State
  const [deletingWs, setDeletingWs] = useState(false);

  // Invite Member State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [inviteFocused, setInviteFocused] = useState(false);

  // Derived State
  const myRole =
    workspaceMembers.find((m) => String(m._id) === String(user?.id ?? user?._id))?.role ||
    "viewer";
  const isOwner = myRole === "owner";

  // Fetch Workspaces
  const fetchWorkspaces = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoadingWorkspaces(false);
      return [];
    }

    setError("");
    setLoadingWorkspaces(true);
    try {
      const res = await api.get("/workspaces/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const wsData = Array.isArray(res.data) ? res.data : [];
      setWorkspaces(wsData);

      const urlWsId = searchParams.get("wsId");

      if (wsData.length > 0 && !selectedWorkspaceId) {
        if (urlWsId) {
          setSelectedWorkspaceId(urlWsId);
        } else {
          setSelectedWorkspaceId(wsData[0]._id);
        }
      }
      return wsData;
    } catch (err) {
      setError("Failed to load workspaces.");
      return [];
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();

    const token = localStorage.getItem("token");
    let socket = null;

    if (token) {
      socket = io(API_URL.replace("/api", ""), {
        auth: { token },
      });

      socket.on("workspace:joined", (data) => {
        console.log("Workspace joined event received:", data);
        fetchWorkspaces();
      });

      socket.on("workspace:members-updated", (data) => {
        setRefreshMembersTrigger(prev => prev + 1);
      });

      socket.on("workspace:role-updated", (data) => {
        setRefreshMembersTrigger(prev => prev + 1);
      });

      socket.on("workspace:kicked", async ({ workspaceId }) => {
        const updatedWorkspaces = await fetchWorkspaces();
        setSelectedWorkspaceId((currentSelected) => {
          if (String(currentSelected) === String(workspaceId)) {
            if (updatedWorkspaces && updatedWorkspaces.length > 0) {
              navigate(`/dashboard?wsId=${updatedWorkspaces[0]._id}`);
              return updatedWorkspaces[0]._id;
            } else {
              navigate("/dashboard");
              return null;
            }
          }
          return currentSelected;
        });
      });
    }

    // Fallback: listen for custom DOM event from notifications UI
    const handleRefresh = () => {
      console.log("Manual refresh workspaces event received");
      fetchWorkspaces();
    };

    window.addEventListener("refreshWorkspaces", handleRefresh);

    return () => {
      socket?.disconnect();
      window.removeEventListener("refreshWorkspaces", handleRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync selectedWorkspaceId with URL wsId
  useEffect(() => {
    const wsId = searchParams.get("wsId");
    if (wsId && wsId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(wsId);
    }
  }, [searchParams, selectedWorkspaceId]);

  // Fetch workspace details when selectedWorkspaceId changes
  useEffect(() => {
    if (!selectedWorkspaceId) return;

    const fetchWorkspaceData = async () => {
      const token = localStorage.getItem("token");
      try {
        const wsRes = await api.get(`/workspaces/${selectedWorkspaceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWorkspaceName(wsRes.data.name);
        setWorkspaceMembers(
          Array.isArray(wsRes.data.members) ? wsRes.data.members : []
        );
      } catch {
        // console.error("Failed to fetch workspace data", err);
      }
    };

    fetchWorkspaceData();
    // Auto-refresh member data
  }, [selectedWorkspaceId, refreshMembersTrigger]);

  // Handlers
  const handleCreateWorkspace = async (
    e,
    newWsName,
    newWsDescription,
    newWsEmails,
    setShowAddWsModal,
    setNewWsName,
    setNewWsDescription,
    setNewWsEmails
  ) => {
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
      setWsCreateError(
        err.response?.data?.message || "Failed to create workspace."
      );
    } finally {
      setCreatingWs(false);
    }
  };

  const handleRenameWorkspace = async (renameWsName, setShowRenameModal) => {
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
      setWorkspaces((prev) =>
        prev.map((w) =>
          w._id === selectedWorkspaceId ? { ...w, name: renameWsName } : w
        )
      );
      setShowRenameModal(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to rename workspace.");
    } finally {
      setRenamingWs(false);
    }
  };

  const handleDeleteWorkspace = async (deleteConfirmName, setShowDeleteModal) => {
    if (!selectedWorkspaceId) return;
    if (deleteConfirmName !== workspaceName) return;

    const token = localStorage.getItem("token");
    setDeletingWs(true);
    try {
      await api.delete(`/workspaces/${selectedWorkspaceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const remaining = workspaces.filter((w) => w._id !== selectedWorkspaceId);
      setWorkspaces(remaining);
      setShowDeleteModal(false);
      if (remaining.length > 0) {
        setSelectedWorkspaceId(remaining[0]._id);
        navigate(`/dashboard?wsId=${remaining[0]._id}`);
      } else {
        setSelectedWorkspaceId(null);
        navigate("/dashboard");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete workspace.");
    } finally {
      setDeletingWs(false);
    }
  };

  // Invite Logic
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
          headers: { Authorization: `Bearer ${token}` },
        });
        setSuggestedUsers(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Autocomplete error:", e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inviteEmail]);

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
      setWorkspaceMembers((prev) =>
        prev.map((m) =>
          String(m._id) === String(memberId) ? { ...m, role: newRole } : m
        )
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
      setWorkspaceMembers((prev) =>
        prev.filter((m) => String(m._id) !== String(memberId))
      );
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to remove member.");
    }
  };

  return {
    workspaces,
    loadingWorkspaces,
    error,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    workspaceName,
    workspaceMembers,
    myRole,
    isOwner,
    creatingWs,
    wsCreateError,
    setWsCreateError,
    wsCreateSuccess,
    setWsCreateSuccess,
    renamingWs,
    deletingWs,
    inviteEmail,
    setInviteEmail,
    inviting,
    inviteError,
    setInviteError,
    inviteSuccess,
    setInviteSuccess,
    suggestedUsers,
    setSuggestedUsers,
    inviteFocused,
    setInviteFocused,
    handleCreateWorkspace,
    handleRenameWorkspace,
    handleDeleteWorkspace,
    handleInvite,
    handleRoleChange,
    handleRemoveMember,
    fetchWorkspaces,
  };
}
