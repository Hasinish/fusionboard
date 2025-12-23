import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import api from "../lib/api";
import { isLoggedIn, getUser } from "../lib/auth";
import WorkspaceChat from "../components/WorkspaceChat";

function WorkspaceDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const currentUser = getUser();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [inviteEmailsText, setInviteEmailsText] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  // All Users List State
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // [NEW] Pending Invites State (Array of User IDs)
  const [pendingInvites, setPendingInvites] = useState([]);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  // 1. Mark notifications as read when entering this page
  useEffect(() => {
    if (!token || !id) return;
    api.put(
      `/notifications/read/workspace/${id}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch(() => {});
  }, [id, token]);

  // 2. Load Workspace
  const loadWorkspace = async () => {
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.get(`/workspaces/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWorkspace(res.data);
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to load workspace.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // 3. Load All Users (for directory list)
  const loadAllUsers = async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const res = await api.get("/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    } finally {
      setLoadingUsers(false);
    }
  };

  // [NEW] 4. Load Pending Invites
  const loadPendingInvites = async () => {
    if (!token || !id) return;
    try {
      const res = await api.get(`/invitations/workspace/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Expecting array of user IDs
      setPendingInvites(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to load pending invites", e);
    }
  };

  useEffect(() => {
    if (!isLoggedIn() || !token) {
      navigate("/login");
      return;
    }
    loadWorkspace();
    loadAllUsers();
    loadPendingInvites(); // [NEW]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  const isOwner =
    workspace &&
    workspace.owner &&
    currentUser &&
    workspace.owner._id === currentUser.id;

  // Helper to check if user is already in workspace
  const isMember = (userId) => {
    if (!workspace?.members) return false;
    return workspace.members.some((m) => m._id === userId);
  };

  // [NEW] Helper to check if user is already invited
  const isInvited = (userId) => {
    return pendingInvites.includes(userId);
  };

  // Handle Manual Email Invite
  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError("");
    setInviteMessage("");

    if (!inviteEmailsText.trim()) {
      setInviteError("Please enter at least one email.");
      return;
    }

    const memberEmails = inviteEmailsText
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

    if (memberEmails.length === 0) {
      setInviteError("Please enter valid email(s).");
      return;
    }

    await sendInviteRequest(memberEmails);
    // Refresh invites list to update UI if registered users were invited
    loadPendingInvites();
  };

  // Handle Button Click Invite
  const handleButtonInvite = async (user) => {
    setInviteEmailsText("");
    await sendInviteRequest([user.email]);
    
    // [NEW] Optimistically update pending invites
    setPendingInvites((prev) => [...prev, user._id]);
  };

  const sendInviteRequest = async (memberEmails) => {
    if (!token) return;
    setInviteLoading(true);
    setInviteError("");
    setInviteMessage("");
    try {
      const res = await api.post(
        `/workspaces/${id}/invite`,
        { memberEmails },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setInviteMessage(res.data.message || "Invitations sent.");
      if (inviteEmailsText) setInviteEmailsText("");
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to send invitations.";
      setInviteError(msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    setActionError("");
    setActionMessage("");

    if (!token) {
      setActionError("Not authenticated.");
      return;
    }

    try {
      await api.patch(
        `/workspaces/${id}/members/${memberId}/role`,
        { role: newRole },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setActionMessage("Member role updated.");
      await loadWorkspace();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to update member role.";
      setActionError(msg);
    }
  };

  const handleRemoveMember = async (memberId) => {
    setActionError("");
    setActionMessage("");

    if (!window.confirm("Remove this member from the workspace?")) return;

    if (!token) {
      setActionError("Not authenticated.");
      return;
    }

    try {
      await api.delete(`/workspaces/${id}/members/${memberId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setActionMessage("Member removed from workspace.");
      await loadWorkspace();
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to remove member.";
      setActionError(msg);
    }
  };

  const renderStatusDot = (isOnline) => (
    <span
      className={`inline-block w-2 h-2 rounded-full mr-2 ${
        isOnline ? "bg-green-500" : "bg-red-500"
      }`}
    />
  );

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">
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
              {/* Header: Workspace info + actions */}
              <div className="mb-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold mb-1">{workspace.name}</h1>
                    {workspace.description && (
                      <p className="text-sm text-neutral-600">
                        {workspace.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/workspaces/${id}/boards`)}
                    >
                      Boards
                    </button>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/workspaces/${id}/voice`)}
                    >
                      Join Voice Chat
                    </button>
                  </div>
                </div>
              </div>

              {(actionError || actionMessage) && (
                <div className="mb-4 space-y-2">
                  {actionError && (
                    <div className="alert alert-error py-2 text-sm">
                      <span>{actionError}</span>
                    </div>
                  )}
                  {actionMessage && (
                    <div className="alert alert-success py-2 text-sm">
                      <span>{actionMessage}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Members */}
                <div className="card bg-base-100 shadow-md lg:col-span-2">
                  <div className="card-body">
                    <h2 className="card-title text-base mb-2">
                      Workspace Members
                    </h2>
                    <ul className="space-y-3 text-sm">
                      {workspace.members && workspace.members.length > 0 ? (
                        workspace.members.map((m) => {
                          const isCurrentUser =
                            currentUser && m._id === currentUser.id;

                          return (
                            <li
                              key={m._id}
                              className="flex flex-col border-b border-base-200 pb-2 last:border-0"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  {renderStatusDot(m.isOnline)}
                                  <div>
                                    <div className="font-medium">
                                      {m.name}
                                      {isCurrentUser && (
                                        <span className="text-xs text-neutral-500 ml-1">
                                          (you)
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-neutral-500">
                                      {m.email}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isOwner ? (
                                    <select
                                      className="select select-xs select-bordered"
                                      value={m.role}
                                      disabled={isCurrentUser && m.role === "owner"}
                                      onChange={(e) =>
                                        handleRoleChange(m._id, e.target.value)
                                      }
                                    >
                                      <option value="owner">Owner</option>
                                      <option value="editor">Editor</option>
                                      <option value="viewer">Viewer</option>
                                    </select>
                                  ) : (
                                    <span className="badge badge-outline">
                                      {m.role}
                                    </span>
                                  )}

                                  {isOwner &&
                                    !(m.role === "owner" && isCurrentUser) && (
                                      <button
                                        className="btn btn-xs btn-ghost"
                                        onClick={() => handleRemoveMember(m._id)}
                                      >
                                        Remove
                                      </button>
                                    )}
                                </div>
                              </div>
                            </li>
                          );
                        })
                      ) : (
                        <li className="text-neutral-500 text-sm">
                          No members yet.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Right column: owner + invite */}
                <div className="space-y-4">
                  <div className="card bg-base-100 shadow-md">
                    <div className="card-body">
                      <h2 className="card-title text-base mb-2">
                        Workspace Owner
                      </h2>
                      {workspace.owner ? (
                        <div className="flex items-center gap-2 text-sm">
                          {renderStatusDot(workspace.owner.isOnline)}
                          <div>
                            <div className="font-medium">
                              {workspace.owner.name}
                              {currentUser &&
                                workspace.owner._id === currentUser.id && (
                                  <span className="text-xs text-neutral-500 ml-1">
                                    (you)
                                  </span>
                                )}
                            </div>
                            <div className="text-xs text-neutral-500">
                              {workspace.owner.email}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-500">
                          Owner information not available.
                        </p>
                      )}
                    </div>
                  </div>

                  {isOwner && (
                    <>
                      {/* Invite By Email Manual Input */}
                      <div className="card bg-base-100 shadow-md">
                        <div className="card-body">
                          <h2 className="card-title text-base mb-2">
                            Invite By Email
                          </h2>
                          {inviteError && (
                            <div className="alert alert-error py-2 text-xs mb-2">
                              <span>{inviteError}</span>
                            </div>
                          )}
                          {inviteMessage && (
                            <div className="alert alert-success py-2 text-xs mb-2">
                              <span>{inviteMessage}</span>
                            </div>
                          )}
                          <form onSubmit={handleInvite} className="space-y-2">
                            <textarea
                              className="textarea textarea-bordered w-full text-sm"
                              rows={2}
                              value={inviteEmailsText}
                              onChange={(e) =>
                                setInviteEmailsText(e.target.value)
                              }
                              placeholder="example1@mail.com, example2@mail.com"
                            />
                            <p className="text-xs text-neutral-500">
                              Separate multiple emails with commas.
                            </p>
                            <button
                              type="submit"
                              className={`btn btn-primary btn-sm w-full ${
                                inviteLoading ? "btn-disabled" : ""
                              }`}
                              disabled={inviteLoading}
                            >
                              {inviteLoading ? "Sending..." : "Invite"}
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* All Users Directory List */}
                      <div className="card bg-base-100 shadow-md">
                        <div className="card-body p-4">
                          <h2 className="card-title text-base mb-2">
                            All Users Directory
                          </h2>
                          {loadingUsers ? (
                            <p className="text-xs text-neutral-500">Loading...</p>
                          ) : (
                            <div className="max-h-60 overflow-y-auto space-y-2">
                              {allUsers
                                .filter((u) => u._id !== currentUser.id) // Don't show self
                                .map((u) => {
                                  const alreadyIn = isMember(u._id);
                                  const alreadyInvited = isInvited(u._id); // [NEW] Check
                                  
                                  return (
                                    <div
                                      key={u._id}
                                      className="flex items-center justify-between border-b border-base-200 pb-2 last:border-0"
                                    >
                                      <div className="text-sm truncate mr-2">
                                        <div className="font-semibold">{u.name}</div>
                                        <div className="text-xs text-neutral-500">
                                          {u.email}
                                        </div>
                                      </div>
                                      {alreadyIn ? (
                                        <span className="badge badge-ghost badge-xs">
                                          Member
                                        </span>
                                      ) : alreadyInvited ? (
                                        // [NEW] Badge for invited users
                                        <span className="badge badge-neutral badge-xs opacity-60">
                                          Invited
                                        </span>
                                      ) : (
                                        <button
                                          className="btn btn-xs btn-outline"
                                          onClick={() => handleButtonInvite(u)}
                                          disabled={inviteLoading}
                                        >
                                          Invite
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              {allUsers.length < 2 && (
                                <p className="text-xs text-neutral-400">
                                  No other users found.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Chat */}
              <div className="mt-6">
                <WorkspaceChat workspaceId={id} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default WorkspaceDetailsPage;