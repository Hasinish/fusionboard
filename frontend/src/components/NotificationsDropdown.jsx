import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Check, X, Bell, ExternalLink, Mail, UserPlus, Info } from "lucide-react";

const NotificationsDropdown = ({ onClose }) => {
    const navigate = useNavigate();
    const [invitations, setInvitations] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchAll = async () => {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            setLoading(true);
            const [resInvites, resNotes] = await Promise.all([
                api.get("/invitations/my", { headers: { Authorization: `Bearer ${token}` } }),
                api.get("/notifications", { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setInvitations(Array.isArray(resInvites.data) ? resInvites.data : []);
            setNotifications(Array.isArray(resNotes.data) ? resNotes.data : []);
        } catch (err) {
            console.error("Failed to load notifications", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    const handleInviteAction = async (id, action) => {
        const token = localStorage.getItem("token");
        if (!token) return;
        try {
            await api.post(`/invitations/${id}/${action}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setInvitations((prev) => prev.filter((inv) => inv._id !== id));
        } catch (err) {
            console.error("Failed to update invitation", err);
        }
    };

    const handleNotificationClick = async (note) => {
        const token = localStorage.getItem("token");
        if (note.workspace) {
            try {
                await api.put(`/notifications/read/workspace/${note.workspace._id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            } catch (e) {
                console.error(e);
            }
            navigate(`/dashboard?wsId=${note.workspace._id}`);
            onClose();
        }
    };

    const hasContent = invitations.length > 0 || notifications.length > 0;

    return (
        <div
            className="fixed inset-x-4 top-[80px] md:absolute md:inset-auto md:top-full md:right-0 md:mt-2 md:w-96 max-h-[calc(100vh-140px)] bg-white rounded-2xl shadow-2xl border border-[#E8DDD0] z-[100] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-5 py-4 border-b border-[#E8DDD0] flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                    <h3 className="font-black text-[#1A1A2E] text-lg leading-tight">Notifications</h3>
                    <p className="text-[10px] font-bold text-[#6B6560] uppercase tracking-wider mt-0.5">Stay updated</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#FDFBF7]">
                {loading ? (
                    <div className="p-10 text-center">
                        <div className="w-8 h-8 border-4 border-[#244e8a]/20 border-t-[#244e8a] rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-sm font-bold text-[#6B6560]">Loading updates...</p>
                    </div>
                ) : !hasContent ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-[#E8DDD0]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Bell size={24} className="text-[#6B6560]" />
                        </div>
                        <p className="text-sm font-bold text-[#1A1A2E]">All caught up!</p>
                        <p className="text-xs text-[#6B6560] mt-1">No new notifications at the moment.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[#E8DDD0]/50">
                        {/* Invitations */}
                        {invitations.length > 0 && (
                            <div className="bg-[#FFF9EA]/50">
                                <div className="px-5 py-2.5 flex items-center gap-2">
                                    <UserPlus size={12} className="text-[#A67C00]" />
                                    <span className="text-[10px] font-black text-[#A67C00] uppercase tracking-widest">Workspace Invites</span>
                                </div>
                                {invitations.map((inv) => (
                                    <div key={inv._id} className="px-5 py-4 hover:bg-[#FFF4D6] transition-colors border-l-4 border-[#FFD93D]">
                                        <p className="text-sm font-bold text-[#1A1A2E] leading-tight">
                                            Join <span className="text-[#244e8a]">{inv.workspace?.name || "Workspace"}</span>
                                        </p>
                                        <p className="text-xs text-[#6B6560] mt-1 line-clamp-2">
                                            Invited by <span className="font-bold">{inv.invitedBy?.name}</span>
                                        </p>
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => handleInviteAction(inv._id, "accept")}
                                                className="flex-1 bg-[#244e8a] text-white text-[11px] font-black py-2 rounded-lg shadow-sm hover:bg-[#1d3f70] transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <Check size={13} strokeWidth={3} /> Accept
                                            </button>
                                            <button
                                                onClick={() => handleInviteAction(inv._id, "reject")}
                                                className="flex-1 bg-white border border-[#E8DDD0] text-[#1A1A2E] text-[11px] font-black py-2 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all flex items-center justify-center gap-1.5"
                                            >
                                                <X size={13} strokeWidth={3} /> Decline
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* General Notifications */}
                        {notifications.length > 0 && (
                            <div>
                                {invitations.length > 0 && (
                                    <div className="px-5 py-2.5 flex items-center gap-2 bg-[#FDFBF7]">
                                        <Mail size={12} className="text-[#6B6560]" />
                                        <span className="text-[10px] font-black text-[#6B6560] uppercase tracking-widest">Recent Activity</span>
                                    </div>
                                )}
                                {notifications.map((note) => (
                                    <div
                                        key={note._id}
                                        onClick={() => handleNotificationClick(note)}
                                        className={`px-5 py-4 cursor-pointer transition-all flex gap-3 group bg-white hover:bg-[#F5EAD8]/50 ${!note.isRead ? "border-l-4 border-[#244e8a]" : ""}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!note.isRead ? "bg-[#244e8a]/10" : "bg-gray-100"}`}>
                                            <Info size={14} className={!note.isRead ? "text-[#244e8a]" : "text-gray-400"} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-[13px] leading-snug ${!note.isRead ? "font-bold text-[#1A1A2E]" : "text-[#6B6560]"}`}>
                                                {note.text}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                    {new Date(note.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </span>
                                                {!note.isRead && (
                                                    <span className="w-2 h-2 rounded-full bg-[#244e8a]"></span>
                                                )}
                                                {note.workspace && (
                                                    <span className="flex items-center gap-1 text-[10px] font-black text-[#244e8a] group-hover:underline">
                                                        View <ExternalLink size={10} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="px-5 py-3 border-t border-[#E8DDD0] bg-white flex justify-center">
                <button
                    onClick={onClose}
                    className="text-[11px] font-black text-[#6B6560] hover:text-[#1A1A2E] transition-colors"
                >
                    Dismiss
                </button>
            </div>
        </div>
    );
};

export default NotificationsDropdown;
