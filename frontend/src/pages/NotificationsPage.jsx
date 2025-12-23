import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import api from "../lib/api";
import { isLoggedIn } from "../lib/auth";

function NotificationsPage() {
  const navigate = useNavigate();

  const [invitations, setInvitations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchAll = async () => {
    const token = localStorage.getItem("token");
    if (!isLoggedIn() || !token) {
      navigate("/login");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Fetch Invitations
      const resInvites = await api.get("/invitations/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInvitations(Array.isArray(resInvites.data) ? resInvites.data : []);

      // Fetch Message Notifications
      const resNotes = await api.get("/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(Array.isArray(resNotes.data) ? resNotes.data : []);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to load notifications.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [navigate]);

  const handleInviteAction = async (id, action) => {
    setError("");
    setMessage("");
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await api.post(
        `/invitations/${id}/${action}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(
        action === "accept" ? "Invitation accepted." : "Invitation rejected."
      );
      // Remove from list locally
      setInvitations((prev) => prev.filter((inv) => inv._id !== id));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update invitation.");
    }
  };

  const handleNotificationClick = (note) => {
    if (note.workspace) {
      // Navigate to workspace. The WorkspaceDetailsPage will mark it as read on mount.
      navigate(`/workspaces/${note.workspace._id}`);
    }
  };

  const hasContent = invitations.length > 0 || notifications.length > 0;

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold mb-2">Notifications</h1>
          <p className="text-sm text-neutral-500 mb-4">
            Manage invitations and see new messages.
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
              Loading...
            </div>
          ) : !hasContent ? (
            <div className="rounded-box border border-base-300 p-6 bg-base-100 text-sm text-neutral-500">
              You have no notifications.
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Invitations Section */}
              {invitations.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Invitations</h2>
                  <div className="space-y-3">
                    {invitations.map((inv) => (
                      <div
                        key={inv._id}
                        className="card bg-base-100 shadow-sm border border-base-200"
                      >
                        <div className="card-body py-4">
                          <h3 className="font-semibold text-base">
                            Join Workspace: {inv.workspace?.name || "Unknown"}
                          </h3>
                          <p className="text-sm text-neutral-600 mb-2">
                            Invited by {inv.invitedBy?.name} ({inv.invitedBy?.email})
                          </p>
                          <div className="flex gap-2">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleInviteAction(inv._id, "accept")}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => handleInviteAction(inv._id, "reject")}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Notifications Section */}
              {notifications.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Messages</h2>
                  <div className="space-y-3">
                    {notifications.map((note) => (
                      <div
                        key={note._id}
                        className="card bg-base-100 shadow-sm border border-base-200 cursor-pointer hover:bg-base-50 transition"
                        onClick={() => handleNotificationClick(note)}
                      >
                        <div className="card-body py-4 flex flex-row items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              {!note.isRead && (
                                <div
                                  className="w-2 h-2 rounded-full bg-blue-600"
                                  title="Unread"
                                ></div>
                              )}
                              <p className={`text-sm ${!note.isRead ? "font-bold text-black" : "text-neutral-600"}`}>
                                {note.text}
                              </p>
                            </div>
                            <p className="text-xs text-neutral-400 mt-1">
                              {new Date(note.updatedAt).toLocaleString()}
                            </p>
                          </div>
                          
                          
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default NotificationsPage;