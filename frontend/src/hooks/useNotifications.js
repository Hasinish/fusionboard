import { useState, useRef, useEffect } from "react";
import api from "../lib/api";

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef(null);

  const fetchUnreadCount = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const [resInvites, resNotes] = await Promise.all([
        api.get("/invitations/my", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get("/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const invitesCount = Array.isArray(resInvites.data)
        ? resInvites.data.length
        : 0;
      const unreadNotesCount = Array.isArray(resNotes.data)
        ? resNotes.data.filter((n) => !n.isRead).length
        : 0;
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

  return {
    unreadCount,
    setUnreadCount,
    showNotifications,
    setShowNotifications,
    notificationsRef,
    fetchUnreadCount,
  };
}
