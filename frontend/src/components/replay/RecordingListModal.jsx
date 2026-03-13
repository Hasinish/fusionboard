import React, { useEffect, useState } from "react";
import { History, Play, X, Clock, Calendar, User, Trash2, Loader2 } from "lucide-react";
import api from "../../lib/api";
import { useNavigate } from "react-router-dom";

export default function RecordingListModal({ boardId, onClose, isDark }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    async function fetchRecordings() {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      try {
        const res = await api.get(`/recordings/board/${boardId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRecordings(res.data);
      } catch (err) {
        console.error("Failed to fetch recordings", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecordings();
  }, [boardId]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this recording? This action cannot be undone.")) return;
    
    setDeletingId(id);
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    try {
      await api.delete(`/recordings/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecordings(prev => prev.filter(r => r._id !== id));
    } catch (err) {
      console.error("Failed to delete recording", err);
      alert("Failed to delete recording. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`relative w-full max-w-2xl max-h-[80vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${
        isDark ? "bg-[#1f1f1f] border-white/10" : "bg-white border-gray-200"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDark ? "bg-primary/10 text-primary" : "bg-primary/5 text-primary"}`}>
              <History size={24} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Board Recordings</h2>
              <p className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-500"}`}>
                {recordings.length} sessions captured
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${isDark ? "hover:bg-white/5 text-white/40 hover:text-white" : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="loading loading-spinner loading-md text-primary" />
              <span className={`text-sm font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}>Loading recordings...</span>
            </div>
          ) : recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDark ? "bg-white/5 text-white/10" : "bg-gray-50 text-gray-200"}`}>
                <Play size={32} />
              </div>
              <h3 className={`text-lg font-bold mb-1 ${isDark ? "text-white/80" : "text-gray-700"}`}>No recordings yet</h3>
              <p className={`text-sm max-w-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
                Hit the record button to start capturing your whiteboard sessions and audio.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {recordings.map((rec) => (
                <div 
                  key={rec._id}
                  onClick={() => navigate(`/recordings/${rec._id}`)}
                  className={`group flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${
                    isDark 
                      ? "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10" 
                      : "bg-gray-50 border-gray-100 hover:bg-gray-100 hover:border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${
                      isDark ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
                    }`}>
                      <Play size={20} fill="currentColor" />
                    </div>
                    <div>
                      <h4 className={`font-bold transition-colors ${isDark ? "text-white group-hover:text-primary" : "text-gray-900 group-hover:text-primary"}`}>
                        {rec.title || "Untitled Session"}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 opacity-60">
                         <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                           <Calendar size={12} />
                           {new Date(rec.createdAt).toLocaleDateString()}
                         </div>
                         <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                           <Clock size={12} />
                           {formatDuration(rec.durationMs)}
                         </div>
                         {rec.createdBy && (
                           <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                             <User size={12} />
                             {rec.createdBy.name || "User"}
                           </div>
                         )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(e, rec._id)}
                      disabled={deletingId === rec._id}
                      className={`p-2 rounded-xl transition-all ${
                        isDark 
                          ? "bg-white/5 text-white/40 hover:bg-red-500/20 hover:text-red-400" 
                          : "bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      }`}
                      title="Delete recording"
                    >
                      {deletingId === rec._id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    </button>
                    
                    <div className={`p-2 rounded-full transition-all group-hover:translate-x-1 ${isDark ? "text-white/20 group-hover:text-white/60" : "text-gray-300 group-hover:text-gray-500"}`}>
                      <Play size={20} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${isDark ? "border-white/5 bg-white/5" : "border-gray-100 bg-gray-50"}`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest text-center ${isDark ? "text-white/20" : "text-gray-400"}`}>
            Recording data is stored securely on our servers
          </p>
        </div>
      </div>
    </div>
  );
}
