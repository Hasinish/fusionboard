import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export function useBoards(selectedWorkspaceId) {
  const navigate = useNavigate();

  const [workspaceBoards, setWorkspaceBoards] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renamingBoard, setRenamingBoard] = useState(false);
  const [targetBoardId, setTargetBoardId] = useState(null);
  const [renameBoardTitle, setRenameBoardTitle] = useState("");

  useEffect(() => {
    if (!selectedWorkspaceId) return;

    const fetchBoards = async () => {
      const token = localStorage.getItem("token");
      setLoadingBoards(true);
      try {
        const res = await api.get(
          `/boards/workspace/${selectedWorkspaceId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setWorkspaceBoards(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch boards", err);
      } finally {
        setLoadingBoards(false);
      }
    };

    fetchBoards();

    // Auto-refresh board data to show active users
    const interval = setInterval(async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await api.get(
          `/boards/workspace/${selectedWorkspaceId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setWorkspaceBoards(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to refresh boards", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedWorkspaceId]);

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

  const handleRenameBoard = async (setShowBoardRenameModal) => {
    if (!renameBoardTitle.trim() || !targetBoardId) return;

    const token = localStorage.getItem("token");
    setRenamingBoard(true);
    try {
      await api.patch(
        `/boards/${targetBoardId}`,
        { title: renameBoardTitle },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorkspaceBoards((prev) =>
        prev.map((b) =>
          b._id === targetBoardId ? { ...b, title: renameBoardTitle } : b
        )
      );
      setShowBoardRenameModal(false);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to rename board.");
    } finally {
      setRenamingBoard(false);
    }
  };

  return {
    workspaceBoards,
    loadingBoards,
    creating,
    renamingBoard,
    targetBoardId,
    setTargetBoardId,
    renameBoardTitle,
    setRenameBoardTitle,
    handleCreateBoard,
    handleDeleteBoard,
    handleRenameBoard,
  };
}
