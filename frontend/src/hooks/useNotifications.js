import { useState, useRef, useEffect } from "react";
import api from "../lib/api";

export function useNotifications() {
  const [invitations, setInvitations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef(null);

  const fetchAll = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
        setLoading(false);
        return;
    }
    try {
      setLoading(true);
      const [resInvites, resNotes] = await Promise.all([
        api.get("/invitations/my", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get("/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      
      const invitesData = Array.isArray(resInvites.data) ? resInvites.data : [];
      const notesData = Array.isArray(resNotes.data) ? resNotes.data : [];
      
      setInvitations(invitesData);
      setNotifications(notesData);
      
      const unreadNotesCount = notesData.filter((n) => !n.isRead).length;
      setUnreadCount(invitesData.length + unreadNotesCount);
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllRead = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await api.put("/notifications/read/all", {}, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(invitations.length);
    } catch (e) {
      console.error("Failed to mark all as read", e);
    }
  };

  const markWorkspaceRead = async (workspaceId) => {
    const token = localStorage.getItem("token");
    if (!token || !workspaceId) return;
    try {
      await api.put(`/notifications/read/workspace/${workspaceId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => {
        const next = prev.map(n => 
          n.workspace?._id === workspaceId ? { ...n, isRead: true } : n
        );
        const unreadNotesCount = next.filter((n) => !n.isRead).length;
        setUnreadCount(invitations.length + unreadNotesCount);
        return next;
      });
    } catch (e) {
      console.error("Failed to mark workspace as read", e);
    }
  };

  const handleInviteAction = async (id, action) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
        await api.post(`/invitations/${id}/${action}`, {}, { headers: { Authorization: `Bearer ${token}` } });
        setInvitations((prev) => prev.filter((inv) => inv._id !== id));
        setUnreadCount(prev => prev - 1);
        if (action === "accept") {
            window.dispatchEvent(new Event("refreshWorkspaces"));
        }
    } catch (err) {
        console.error("Failed to update invitation", err);
    }
  };

  return {
    invitations,
    notifications,
    unreadCount,
    loading,
    showNotifications,
    setShowNotifications,
    notificationsRef,
    fetchAll,
    markAllRead,
    markWorkspaceRead,
    handleInviteAction
  };
}
