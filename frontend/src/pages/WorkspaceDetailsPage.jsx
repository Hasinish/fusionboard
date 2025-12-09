// frontend/src/pages/WorkspaceDetailsPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import api from "../lib/api";
import { isLoggedIn } from "../lib/auth";

function WorkspaceDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!isLoggedIn() || !token) {
      navigate("/login");
      return;
    }

    const fetchWorkspace = async () => {
      setError("");
      setLoading(true);
      try {
        const res = await api.get(`/workspaces/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setWorkspace(res.data);
      } catch (err) {
        const msg =
          err?.response?.data?.message || "Failed to load workspace.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [id, navigate]);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {loading ? (
            <div className="rounded-box border border-base-300 p-6 bg-base-100 text-sm text-neutral-500">
              Loading workspace...
            </div>
          ) : error ? (
            <div className="alert alert-error py-2 text-sm">
              <span>{error}</span>
            </div>
          ) : !workspace ? (
            <div className="rounded-box border border-base-300 p-6 bg-base-100 text-sm text-neutral-500">
              Workspace not found.
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold mb-1">{workspace.name}</h1>
                {workspace.description && (
                  <p className="text-sm text-neutral-600">
                    {workspace.description}
                  </p>
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Members */}
                <div className="card bg-base-100 shadow-md">
                  <div className="card-body">
                    <h2 className="card-title text-base mb-2">
                      Workspace Members
                    </h2>
                    <ul className="space-y-2 text-sm">
                      {workspace.members && workspace.members.length > 0 ? (
                        workspace.members.map((m) => (
                          <li
                            key={m._id}
                            className="flex flex-col border-b border-base-200 pb-1 last:border-0"
                          >
                            <span className="font-medium">{m.name}</span>
                            <span className="text-xs text-neutral-500">
                              {m.email}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className="text-neutral-500 text-sm">
                          No members yet.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Owner info */}
                <div className="card bg-base-100 shadow-md">
                  <div className="card-body">
                    <h2 className="card-title text-base mb-2">
                      Workspace Owner
                    </h2>
                    {workspace.owner ? (
                      <div className="text-sm">
                        <div className="font-medium">
                          {workspace.owner.name}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {workspace.owner.email}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500">
                        Owner information not available.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default WorkspaceDetailsPage;
