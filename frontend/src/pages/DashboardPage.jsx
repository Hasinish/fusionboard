import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, isLoggedIn, clearAuth } from "../lib/auth";
import NavBar from "../components/NavBar";
import api from "../lib/api";

function DashboardPage() {
  const navigate = useNavigate();
  const user = getUser();

  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [error, setError] = useState("");

  // If not logged in, redirect to login
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
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
        setWorkspaces(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError("Failed to load workspaces.");
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    fetchWorkspaces();
  }, []);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      {/* Top Navbar */}
      <NavBar />

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Welcome / user info */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-sm text-neutral-500">
                {user
                  ? `Logged in as ${user.name} (${user.email})`
                  : "Loading user..."}
              </p>
            </div>

            <button onClick={handleLogout} className="btn btn-ghost btn-sm">
              Logout
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-error mb-4 py-2 text-sm">
              <span>{error}</span>
            </div>
          )}

          {/* My Workspaces section */}
          <section>
            <h2 className="text-lg font-semibold mb-3">My Workspaces</h2>

            {loadingWorkspaces ? (
              <div className="rounded-box border border-base-300 p-6 bg-base-100 text-sm text-neutral-500">
                Loading workspaces...
              </div>
            ) : workspaces.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 p-6 text-center text-sm text-neutral-500 bg-base-100">
                No workspaces yet.
                <br />
                Use the{" "}
                <span className="font-semibold">Create workspace</span> button
                in the top right to add one later.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {workspaces.map((ws) => (
                  <div
                    key={ws._id}
                    className="card bg-base-100 shadow-sm cursor-pointer hover:shadow-md transition"
                    onClick={() => navigate(`/workspaces/${ws._id}`)}
                  >
                    <div className="card-body">
                      <h3 className="card-title text-base">{ws.name}</h3>
                      {ws.description && (
                        <p className="text-sm text-neutral-600 line-clamp-2">
                          {ws.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
