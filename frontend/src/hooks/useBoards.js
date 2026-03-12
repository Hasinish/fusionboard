import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import api, { API_URL } from "../lib/api";

export function useBoards(selectedWorkspaceId) {
  const navigate = useNavigate();

  const [workspaceBoards, setWorkspaceBoards] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renamingBoard, setRenamingBoard] = useState(false);
  const [targetBoardId, setTargetBoardId] = useState(null);
  const [renameBoardTitle, setRenameBoardTitle] = useState("");
  const socketRef = useRef(null);

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

    const token = localStorage.getItem("token");
    if (token) {
      const socket = io(API_URL.replace("/api", ""), {
        auth: { token }
      });
      socketRef.current = socket;

      socket.on("connect", () => {
           socket.emit("workspace:join", { workspaceId: selectedWorkspaceId });
         });

      socket.on("board:created", (board) => {
        setWorkspaceBoards(prev =>
          prev.find(b => b._id === board._id) ? prev : [...prev, board]
        );
      });

      socket.on("board:renamed", ({ boardId, title }) => {
        setWorkspaceBoards(prev => prev.map(b => b._id === boardId ? { ...b, title } : b));
      });

      socket.on("board:deleted", ({ boardId }) => {
        setWorkspaceBoards(prev => prev.filter(b => b._id !== boardId));
      });

      socket.on("board:users-updated", ({ boardId, activeUsers }) => {
        setWorkspaceBoards(prev =>
          prev.map(b => b._id === boardId ? { ...b, activeUsers } : b)
        );
      });
    }

    return () => {
      socketRef.current?.disconnect();
    };
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
