import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../lib/api";
import { getUser } from "../lib/auth";

export function useFiles(selectedWorkspaceId, setShowFilesModal) {
  const [searchParams] = useSearchParams();
  const user = getUser();
  const fileInputRef = useRef(null);

  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [filesSuccess, setFilesSuccess] = useState("");
  const [filesWorkspaceData, setFilesWorkspaceData] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Derived values
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
      setWorkspaceFiles((prev) => prev.filter((f) => f.id !== fileId));
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
    } catch {
      alert("Could not get Drive auth URL.");
    }
  };

  const getFileIcon = (mimeType = "") => {
    if (mimeType.includes("image")) return "🖼️";
    if (mimeType.includes("pdf")) return "📄";
    if (
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel")
    )
      return "📊";
    if (
      mimeType.includes("presentation") ||
      mimeType.includes("powerpoint")
    )
      return "📑";
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

  // Handle Google Drive OAuth Redirect or deep links
  useEffect(() => {
    const status = searchParams.get("status");
    const openedFilesModal = searchParams.get("openedFilesModal");
    const wsId = searchParams.get("wsId");

    // Only run this logic if we have params
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
        setFilesError(
          searchParams.get("message") || "Failed to connect Google Drive."
        );
      }
    }

    // Clean up URL if we had params (keeping wsId)
    if (openedFilesModal || status) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("openedFilesModal");
      newParams.delete("status");
      newParams.delete("message");
      const searchString = newParams.toString();
      window.history.replaceState(
        {},
        document.title,
        `${window.location.pathname}${searchString ? "?" + searchString : ""}`
      );
    }
  }, [searchParams, selectedWorkspaceId, setShowFilesModal]);

  return {
    workspaceFiles,
    setWorkspaceFiles,
    filesLoading,
    filesError,
    setFilesError,
    filesSuccess,
    setFilesSuccess,
    filesWorkspaceData,
    setFilesWorkspaceData,
    uploading,
    fileInputRef,
    isDriveConnected,
    isFilesOwner,
    fetchFilesWorkspaceData,
    fetchWorkspaceFiles,
    handleFileUpload,
    handleFileDelete,
    handleConnectDrive,
    getFileIcon,
    formatFileSize,
  };
}
