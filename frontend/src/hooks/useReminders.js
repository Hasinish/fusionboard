import { useState, useCallback, useEffect } from "react";
import api from "../lib/api";

export function useReminders(workspaceId) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchReminders = useCallback(async () => {
    if (!workspaceId) return;
    const token = localStorage.getItem("token");
    setLoading(true);
    try {
      const res = await api.get(`/reminders?workspaceId=${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReminders(res.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch reminders");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const addReminder = async (reminderData) => {
    const token = localStorage.getItem("token");
    try {
      const res = await api.post("/reminders", { ...reminderData, workspaceId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReminders((prev) => [...prev, res.data]);
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to add reminder");
    }
  };

  const updateReminder = async (id, updates) => {
    const token = localStorage.getItem("token");
    try {
      const res = await api.put(`/reminders/${id}`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReminders((prev) =>
        prev.map((r) => (r._id === id ? res.data : r))
      );
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to update reminder");
    }
  };

  const deleteReminder = async (id) => {
    const token = localStorage.getItem("token");
    try {
      await api.delete(`/reminders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReminders((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to delete reminder");
    }
  };

  return {
    reminders,
    loading,
    error,
    fetchReminders,
    addReminder,
    updateReminder,
    deleteReminder,
  };
}
