import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import { isLoggedIn } from "../lib/auth";
import api from "../lib/api";

function WorkspaceBoardsPage() {
  const navigate = useNavigate();
  const { id } = useParams(); // workspaceId

  const [boards, setBoards] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login");
    }
  }, [navigate]);

  const fetchBoards = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setError("");
    setLoadingBoards(true);
    try {
      const res = await api.get(`/boards/workspace/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBoards(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load boards.");
    } finally {
      setLoadingBoards(false);
    }
  };

  useEffect(() => {
    fetchBoards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCreateBoard = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setCreating(true);
    setError("");
    try {
      const res = await api.post(
        "/boards",
        { workspaceId: id, title: "New Board" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const board = res.data;
      navigate(`/workspaces/${id}/boards/${board._id}`);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to create board.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Boards</h1>
              <p className="text-sm text-neutral-500">
                Create a new board, view previous boards, or choose a template.
              </p>
            </div>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate(`/workspaces/${id}`)}
            >
              Back to workspace
            </button>
          </div>

          {error && (
            <div className="alert alert-error py-2 text-sm mb-4">
              <span>{error}</span>
            </div>
          )}

          {/* Create board */}
          <div className="card bg-base-100 shadow-md mb-6">
            <div className="card-body flex flex-row items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Create a new board</h2>
                <p className="text-sm text-neutral-500">
                  Opens a real-time whiteboard.
                </p>
              </div>
              <button
                className={`btn btn-primary ${creating ? "btn-disabled" : ""}`}
                onClick={handleCreateBoard}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create board"}
              </button>
            </div>
          </div>

          {/* Previous boards */}
          <div className="card bg-base-100 shadow-md mb-6">
            <div className="card-body">
              <h2 className="text-lg font-semibold mb-3">Previous boards</h2>

              {loadingBoards ? (
                <div className="rounded-box border border-base-300 p-6 bg-base-100 text-sm text-neutral-500">
                  Loading boards...
                </div>
              ) : boards.length === 0 ? (
                <div className="rounded-box border border-dashed border-base-300 p-6 text-sm text-neutral-500">
                  No boards yet.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {boards.map((b) => (
                    <div
                      key={b._id}
                      className="card bg-base-200 cursor-pointer hover:shadow transition"
                      onClick={() => navigate(`/workspaces/${id}/boards/${b._id}`)}
                    >
                      <div className="card-body py-4">
                        <div className="font-semibold">{b.title}</div>
                        <div className="text-xs text-neutral-500">
                          Updated: {new Date(b.updatedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Templates (placeholder) */}
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="text-lg font-semibold mb-2">Templates</h2>
              <div className="rounded-box border border-dashed border-base-300 p-6 text-sm text-neutral-500">
                Templates will appear here.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default WorkspaceBoardsPage;
