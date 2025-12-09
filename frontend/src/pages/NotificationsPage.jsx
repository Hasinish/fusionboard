// frontend/src/pages/NotificationsPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import api from "../lib/api";
import { isLoggedIn } from "../lib/auth";

function NotificationsPage() {
  const navigate = useNavigate();

  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!isLoggedIn() || !token) {
      navigate("/login");
      return;
    }

    const fetchInvites = async () => {
      setError("");
      setLoading(true);
      try {
        const res = await api.get("/invitations/my", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setInvitations(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        const msg =
          err?.response?.data?.message || "Failed to load invitations.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchInvites();
  }, [navigate]);

  const handleAction = async (id, action) => {
    setError("");
    setMessage("");

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Not authenticated.");
      return;
    }

    try {
      await api.post(
        `/invitations/${id}/${action}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage(
        action === "accept"
          ? "Invitation accepted."
          : "Invitation rejected."
      );

      // Remove from list
      setInvitations((prev) => prev.filter((inv) => inv._id !== id));
    } catch (err) {
      const msg =
        err?.response?.data?.message || "Failed to update invitation.";
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold mb-2">Notifications</h1>
          <p className="text-sm text-neutral-500 mb-4">
            Here you can accept or reject workspace invitations.
          </p>

          {error && (
            <div className="alert alert-error py-2 text-sm mb-3">
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="alert alert-success py-2 text-sm mb-3">
              <span>{message}</span>
            </div>
          )}

          {loading ? (
            <div className="rounded-box border border-base-300 p-6 bg-base-100 text-sm text-neutral-500">
              Loading invitations...
            </div>
          ) : invitations.length === 0 ? (
            <div className="rounded-box border border-base-300 p-6 bg-base-100 text-sm text-neutral-500">
              You have no pending invitations.
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div
                  key={inv._id}
                  className="card bg-base-100 shadow-sm border border-base-200"
                >
                  <div className="card-body">
                    <h2 className="card-title text-base mb-1">
                      Workspace: {inv.workspace?.name || "Unknown"}
                    </h2>
                    <p className="text-sm text-neutral-600 mb-2">
                      Invited by{" "}
                      <span className="font-medium">
                        {inv.invitedBy?.name || "Someone"}
                      </span>{" "}
                      ({inv.invitedBy?.email || "no email"})
                    </p>

                    <div className="flex gap-2">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAction(inv._id, "accept")}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleAction(inv._id, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default NotificationsPage;
