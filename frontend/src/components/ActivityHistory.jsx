import { useEffect, useState } from "react";
import { X, Activity, FileText, MessageSquare, Trash2, Edit3, PlusCircle } from "lucide-react";
import api from "../lib/api";

export default function ActivityHistory({ workspaceId, onClose }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await api.get(`/activities/${workspaceId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setActivities(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [workspaceId]);

  const getIcon = (action) => {
    switch (action) {
      case "created_board": return <PlusCircle size={16} className="text-green-600" />;
      case "deleted_board": return <Trash2 size={16} className="text-red-600" />;
      case "edited_board": return <Edit3 size={16} className="text-blue-600" />;
      case "renamed_board": return <Edit3 size={16} className="text-orange-600" />;
      case "uploaded_file": return <FileText size={16} className="text-purple-600" />;
      case "deleted_file": return <Trash2 size={16} className="text-red-600" />;
      case "sent_message": return <MessageSquare size={16} className="text-gray-600" />;
      default: return <Activity size={16} />;
    }
  };

  const formatText = (act) => {
    const what = <span className="font-semibold text-neutral-800">{act.details}</span>;
    switch (act.action) {
      case "created_board": return <>created board {what}</>;
      case "deleted_board": return <>deleted board {what}</>;
      case "edited_board": return <>edited board {what}</>;
      case "renamed_board": return <>renamed board {what}</>;
      case "uploaded_file": return <>uploaded file {what}</>;
      case "deleted_file": return <>deleted file {what}</>;
      case "sent_message": return <>sent a message: "{what}"</>;
      default: return <>performed action {what}</>;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-base-100 shadow-2xl border-l border-base-300 z-50 transform transition-transform flex flex-col">
      <div className="p-4 border-b border-base-200 flex items-center justify-between bg-base-50">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Activity className="text-primary" /> Activity History
        </h3>
        <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center p-4"><span className="loading loading-spinner"></span></div>
        ) : activities.length === 0 ? (
          <p className="text-neutral-500 text-sm text-center">No recent activity.</p>
        ) : (
          <ul className="steps steps-vertical w-full">
            {activities.map((act) => (
              <li key={act._id} className="step step-primary w-full !text-left">
                 <div className="flex flex-col items-start w-full ml-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
                       <span className="font-bold text-neutral-700">{act.user?.name || "Unknown"}</span>
                       <span className="text-xs">• {new Date(act.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-neutral-600 bg-base-50 p-2 rounded-md w-full border border-base-200">
                       <div className="mt-0.5 shrink-0">{getIcon(act.action)}</div>
                       <span className="break-words leading-tight">{formatText(act)}</span>
                    </div>
                 </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}