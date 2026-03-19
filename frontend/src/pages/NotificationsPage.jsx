import { useNavigate } from "react-router-dom";
import { CheckCheck, Bell, UserPlus, Mail, ExternalLink, Info } from "lucide-react";
import { isLoggedIn } from "../lib/auth";
import { useNotifications } from "../hooks/useNotifications";
import { useEffect } from "react";

function NotificationsPage() {
  const navigate = useNavigate();
  const { 
      invitations, 
      notifications, 
      loading, 
      markAllRead, 
      markWorkspaceRead, 
      handleInviteAction,
      fetchAll
  } = useNotifications();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/");
      return;
    }
    fetchAll();
  }, [navigate]);

  const onNoteClick = async (note) => {
    if (note.workspace) {
      await markWorkspaceRead(note.workspace._id);
      navigate(`/dashboard?wsId=${note.workspace._id}`);
    }
  };

  const hasContent = invitations.length > 0 || notifications.length > 0;
  const hasUnreadNotes = notifications.some(n => !n.isRead);

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col font-sans">
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-4xl font-black text-[#1A1A2E] mb-2 tracking-tight">Notifications</h1>
                <p className="text-sm font-bold text-[#6B6560] uppercase tracking-wider">
                    Manage invitations and stay updated
                </p>
            </div>
            {hasUnreadNotes && (
                <button 
                    onClick={markAllRead}
                    className="flex items-center gap-2 bg-[#244e8a] text-white px-4 py-2.5 rounded-xl font-black text-sm shadow-lg shadow-[#244e8a]/20 hover:bg-[#1d3f70] transition-all active:scale-95"
                >
                    <CheckCheck size={18} /> Mark all read
                </button>
            )}
          </div>

          {loading ? (
            <div className="bg-white rounded-3xl border border-[#E8DDD0] p-12 text-center shadow-sm">
              <div className="w-10 h-10 border-4 border-[#244e8a]/20 border-t-[#244e8a] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm font-bold text-[#6B6560]">Syncing your updates...</p>
            </div>
          ) : !hasContent ? (
            <div className="bg-white rounded-3xl border border-[#E8DDD0] p-16 text-center shadow-sm">
              <div className="w-20 h-20 bg-[#F5EAD8]/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bell size={32} className="text-[#6B6560]" />
              </div>
              <p className="text-xl font-black text-[#1A1A2E]">All caught up!</p>
              <p className="text-[#6B6560] mt-2 font-medium">No new notifications at the moment.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {/* Invitations */}
              {invitations.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4 ml-1">
                    <UserPlus size={18} className="text-[#A67C00]" />
                    <h2 className="text-xs font-black text-[#A67C00] uppercase tracking-[0.2em]">Workspace Invitations</h2>
                  </div>
                  <div className="space-y-4">
                    {invitations.map((inv) => (
                      <div
                        key={inv._id}
                        className="bg-white rounded-2xl border-2 border-[#E8DDD0] p-6 shadow-sm hover:border-[#FFD93D] transition-all"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div>
                            <h3 className="font-black text-xl text-[#1A1A2E] leading-tight mb-1">
                              Join <span className="text-[#244e8a]">{inv.workspace?.name || "Unknown"}</span>
                            </h3>
                            <p className="text-sm text-[#6B6560] font-medium">
                              Invited by <span className="font-bold text-[#1A1A2E]">{inv.invitedBy?.name}</span> ({inv.invitedBy?.email})
                            </p>
                          </div>
                          <div className="flex gap-3">
                            <button
                                onClick={() => handleInviteAction(inv._id, "accept")}
                                className="flex-1 md:flex-none px-6 py-3 bg-[#244e8a] text-white rounded-xl font-black text-sm hover:bg-[#1d3f70] transition-colors shadow-sm"
                            >
                                Accept
                            </button>
                            <button
                                onClick={() => handleInviteAction(inv._id, "reject")}
                                className="flex-1 md:flex-none px-6 py-3 bg-white border-2 border-[#E8DDD0] text-[#1A1A2E] rounded-xl font-black text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                            >
                                Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* General Notifications */}
              {notifications.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-4 ml-1">
                    <Mail size={18} className="text-[#6B6560]" />
                    <h2 className="text-xs font-black text-[#6B6560] uppercase tracking-[0.2em]">Recent Activity</h2>
                  </div>
                  <div className="bg-white rounded-3xl border border-[#E8DDD0] overflow-hidden shadow-sm divide-y divide-[#E8DDD0]/50">
                    {notifications.map((note) => (
                      <div
                        key={note._id}
                        className={`p-6 cursor-pointer transition-all flex gap-4 hover:bg-[#F5EAD8]/20 ${!note.isRead ? "bg-white" : "bg-gray-50/30"}`}
                        onClick={() => onNoteClick(note)}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${!note.isRead ? "bg-[#244e8a]/10" : "bg-gray-100"}`}>
                          <Info size={20} className={!note.isRead ? "text-[#244e8a]" : "text-gray-400"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <p className={`text-lg leading-tight ${!note.isRead ? "font-black text-[#1A1A2E]" : "font-bold text-[#6B6560]"}`}>
                              {note.text}
                            </p>
                            {!note.isRead && (
                                <span className="w-2.5 h-2.5 rounded-full bg-[#244e8a] shrink-0 mt-1"></span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                              {new Date(note.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {note.workspace && (
                                <span className="flex items-center gap-1 text-xs font-black text-[#244e8a] hover:underline">
                                    Open Workspace <ExternalLink size={12} />
                                </span>
                            )}
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