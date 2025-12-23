// frontend/src/components/NavBar.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, isLoggedIn } from "../lib/auth";
import api from "../lib/api";

function NavBar() {
  const user = getUser();
  const initial = user?.name?.[0]?.toUpperCase() || "U";
  const navigate = useNavigate();

  const [totalBadge, setTotalBadge] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!isLoggedIn()) return;
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        // 1. Get Invitations
        const resInvites = await api.get("/invitations/my", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const inviteCount = Array.isArray(resInvites.data)
          ? resInvites.data.length
          : 0;

        // 2. Get Notifications (filtered by unread)
        const resNotes = await api.get("/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const unreadNotesCount = Array.isArray(resNotes.data)
          ? resNotes.data.filter((n) => !n.isRead).length
          : 0;

        setTotalBadge(inviteCount + unreadNotesCount);
      } catch {
        // keep silent
      }
    };

    fetchData();
    // Poll every 10 seconds to keep badge updated
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
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
            className="btn btn-ghost btn-sm relative"
            onClick={() => navigate("/notifications")}
          >
            Notifications
            {totalBadge > 0 && (
              <span className="badge badge-secondary ml-1">{totalBadge}</span>
            )}
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/workspaces/create")}
          >
            Create workspace
          </button>

          {/* Round human icon */}
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