import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import api from "../lib/api";
import { isLoggedIn } from "../lib/auth";
import { 
  Activity, 
  FileText, 
  MessageSquare, 
  Trash2, 
  Edit3, 
  PlusCircle,
  ArrowLeft
} from "lucide-react";

export default function WorkspaceActivityPage() {
  const { id } = useParams(); // workspaceId
  const navigate = useNavigate();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/activities/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setActivities(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        setError(e?.response?.data?.message || "Failed to load activity history.");
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [id]);

  const getIcon = (action) => {
    switch (action) {
      case "created_board": return <PlusCircle size={20} className="text-green-600" />;
      case "deleted_board": return <Trash2 size={20} className="text-red-600" />;
      case "edited_board": return <Edit3 size={20} className="text-blue-600" />;
      case "renamed_board": return <Edit3 size={20} className="text-orange-600" />;
      case "uploaded_file": return <FileText size={20} className="text-purple-600" />;
      case "deleted_file": return <Trash2 size={20} className="text-red-600" />;
      case "sent_message": return <MessageSquare size={20} className="text-gray-600" />;
      default: return <Activity size={20} />;
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
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Activity History</h1>
              <p className="text-sm text-neutral-500">
                Recent actions in this workspace.
              </p>
            </div>

            <button
              className="btn btn-ghost btn-sm gap-2"
              onClick={() => navigate(`/workspaces/${id}`)}
            >
              <ArrowLeft size={16} /> Back to workspace
            </button>
          </div>

          {error && (
            <div className="alert alert-error py-2 text-sm mb-4">
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="rounded-box border border-base-300 p-6 bg-base-100 text-sm text-neutral-500">
              Loading activity...
            </div>
          ) : activities.length === 0 ? (
            <div className="rounded-box border border-base-300 p-6 bg-base-100 text-sm text-neutral-500 text-center">
              No recent activity found.
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((act) => (
                <div
                  key={act._id}
                  className="card bg-base-100 shadow-sm border border-base-200"
                >
                  <div className="card-body py-4 flex flex-row items-start gap-4">
                    <div className="mt-1 bg-base-200 p-2 rounded-full">
                        {getIcon(act.action)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-neutral-600">
                        <span className="font-bold text-neutral-900">
                            {act.user?.name || "Unknown"}
                        </span>{" "}
                        {formatText(act)}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {new Date(act.createdAt).toLocaleString()}
                      </p>
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