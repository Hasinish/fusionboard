// frontend/src/components/NavBar.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, isLoggedIn } from "../lib/auth";
import api from "../lib/api";

function NavBar() {
  const user = getUser();
  const initial = user?.name?.[0]?.toUpperCase() || "U";
  const navigate = useNavigate();

  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchInvites = async () => {
      if (!isLoggedIn()) return;
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const res = await api.get("/invitations/my", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPendingCount(Array.isArray(res.data) ? res.data.length : 0);
      } catch {
        // keep silent for navbar
      }
    };

    fetchInvites();
  }, []);

  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="max-w-6xl mx-auto flex w-full items-center justify-between px-4">
        {/* Left: Logo / Name */}
        <div className="flex items-center gap-2">
          <span
            className="text-xl font-bold tracking-tight cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            Fusion<span className="text-primary">Board</span>
          </span>
        </div>

        {/* Right: Create workspace + notifications + profile icon */}
        <div className="flex items-center gap-4">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate("/notifications")}
          >
            Notifications
            {pendingCount > 0 && (
              <span className="badge badge-secondary ml-1">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/workspaces/create")}
          >
            Create workspace
          </button>

          {/* Round human icon (avatar placeholder) */}
          <div
            className="avatar cursor-pointer"
            onClick={() => navigate("/profile")}
            title="Profile"
          >
            <div className="w-10 rounded-full bg-neutral text-neutral-content flex items-center justify-center">
              <span className="text-lg font-semibold">{initial}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NavBar;
