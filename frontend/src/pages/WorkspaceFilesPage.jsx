import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  FileText, 
  Download, 
  Eye, 
  Trash2, 
  UploadCloud, 
  ArrowLeft, 
  File, 
  Image as ImageIcon 
} from "lucide-react";
import NavBar from "../components/NavBar";
import api from "../lib/api";
import { isLoggedIn } from "../lib/auth";

export default function WorkspaceFilesPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) navigate("/login");
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await api.get(`/drive/workspace/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFiles(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError("");
    setMsg("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("workspaceId", id);

    try {
      const token = localStorage.getItem("token");
      await api.post("/drive/upload", formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setMsg("File uploaded successfully!");
      fetchFiles(); 
    } catch (err) {
      setError("Upload failed.");
    } finally {
      setUploading(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleDelete = async (fileId) => {
    if(!window.confirm("Are you sure you want to delete this file?")) return;
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/drive/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFiles(files.filter(f => f.id !== fileId));
    } catch (err) {
      alert("Failed to delete file");
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (mimeType && mimeType.includes("image")) return <ImageIcon size={20} className="text-purple-500" />;
    if (mimeType && mimeType.includes("pdf")) return <FileText size={20} className="text-red-500" />;
    return <File size={20} className="text-blue-500" />;
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-8">
          
          {/* --- Header Section --- */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <UploadCloud className="text-primary" size={32} /> 
                Workspace Files
              </h1>
              <p className="text-neutral-500 mt-1">
                Manage documents and assets for this workspace.
              </p>
            </div>
            <button 
              onClick={() => navigate(`/workspaces/${id}`)}
              className="btn btn-outline gap-2"
            >
              <ArrowLeft size={16} /> Back to Workspace
            </button>
          </div>

          {/* --- Upload Card --- */}
          <div className="card bg-base-100 shadow-sm border border-base-300 mb-8">
            <div className="card-body">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="card-title text-lg">Upload File</h2>
                  <p className="text-sm text-neutral-500">
                    Supported formats: Images, PDF, Docs. Max 15GB (shared).
                  </p>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                   <label className={`btn btn-primary gap-2 w-full sm:w-auto ${uploading ? 'btn-disabled' : ''}`}>
                    {uploading ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      <UploadCloud size={18} />
                    )}
                    {uploading ? "Uploading..." : "Select & Upload"}
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={handleUpload} 
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              {msg && (
                <div className="alert alert-success mt-4 py-2 text-sm rounded-md flex items-center">
                  <CheckCircle size={16} className="mr-2" /> {msg}
                </div>
              )}
              {error && (
                <div className="alert alert-error mt-4 py-2 text-sm rounded-md">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* --- Files Table --- */}
          <div className="card bg-base-100 shadow-xl overflow-hidden">
            <div className="card-body p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 gap-3 text-neutral-400">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                  <p>Loading your files...</p>
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 gap-4 text-neutral-400 bg-base-50">
                  <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center">
                    <File size={32} opacity={0.3} />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-neutral-600">No files yet</p>
                    <p className="text-sm">Upload a document to get started.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-lg w-full">
                    {/* Head */}
                    <thead className="bg-base-200 text-base-content/70">
                      <tr>
                        <th className="pl-6">Name</th>
                        <th>Size</th>
                        <th>Uploaded</th>
                        <th className="text-right pr-6">Actions</th>
                      </tr>
                    </thead>
                    {/* Body */}
                    <tbody>
                      {files.map((f) => (
                        <tr key={f.id} className="hover:bg-base-50 transition-colors group align-middle">
                          <td className="pl-6">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-base-200 flex items-center justify-center text-primary-content">
                                {getFileIcon(f.mimeType)}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm sm:text-base truncate max-w-[150px] sm:max-w-xs" title={f.name}>
                                  {f.name}
                                </span>
                                <span className="text-[10px] text-neutral-400 sm:hidden">
                                  {formatSize(f.size)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="text-sm font-mono opacity-70 hidden sm:table-cell align-middle">
                            {formatSize(f.size)}
                          </td>
                          <td className="text-sm opacity-70 align-middle">
                            {new Date(f.createdTime).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="text-right pr-6 align-middle">
                            {/* FIX APPLIED HERE:
                                1. 'flex items-center justify-end' ensures horizontal container alignment
                                2. 'inline-flex items-center justify-center' on buttons ensures internal icon centering
                            */}
                            <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <a 
                                href={f.webViewLink} 
                                target="_blank" 
                                rel="noreferrer"
                                className="btn btn-square btn-sm btn-ghost inline-flex items-center justify-center tooltip tooltip-left"
                                data-tip="Preview"
                              >
                                <Eye size={18} />
                              </a>
                              <a 
                                href={f.webContentLink} 
                                className="btn btn-square btn-sm btn-ghost inline-flex items-center justify-center tooltip tooltip-left"
                                data-tip="Download"
                              >
                                <Download size={18} />
                              </a>
                              <button 
                                onClick={() => handleDelete(f.id)}
                                className="btn btn-square btn-sm btn-ghost text-error hover:bg-error/10 inline-flex items-center justify-center tooltip tooltip-left"
                                data-tip="Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

// Simple Helper Icon for Success Message
function CheckCircle({ size, className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}