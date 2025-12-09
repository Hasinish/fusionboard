// frontend/src/pages/DashboardPage.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, isLoggedIn, clearAuth } from "../lib/auth";
import NavBar from "../components/NavBar";

function DashboardPage() {
  const navigate = useNavigate();
  const user = getUser();

  // If not logged in, redirect to login
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login");
    }
  }, [navigate]);

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
              <h1 className="text-2xl font-bold">
                Dashboard
              </h1>
              <p className="text-sm text-neutral-500">
                {user
                  ? `Logged in as ${user.name} (${user.email})`
                  : "Loading user..."}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="btn btn-ghost btn-sm"
            >
              Logout
            </button>
          </div>

          {/* My Workspaces section */}
          <section>
            <h2 className="text-lg font-semibold mb-3">
              My Workspaces
            </h2>

            <div className="rounded-box border border-dashed border-base-300 p-6 text-center text-sm text-neutral-500 bg-base-100">
              No workspaces yet.
              <br />
              Use the <span className="font-semibold">Create workspace</span> button in the top
              right to add one later.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
