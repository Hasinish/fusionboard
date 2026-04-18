import React from "react";
import {
  X,
  Link as LinkIcon,
  Loader2,
  Upload,
  CheckCircle,
  Folder,
  Eye,
  Download,
  Trash2,
} from "lucide-react";

export default function FilesModal({
  isOpen,
  onClose,
  workspaceName,
  filesWorkspaceData,
  isDriveConnected,
  isFilesOwner,
  handleConnectDrive,
  fileInputRef,
  handleFileUpload,
  uploading,
  filesSuccess,
  filesError,
  filesLoading,
  workspaceFiles,
  getFileIcon,
  formatFileSize,
  handleFileDelete,
  handleFileDownload,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-md transition-all duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-[#E8DDD0] animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Section 1: Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[#E8DDD0] bg-white">
          <div>
            <h2 className="font-black text-[#1A1A2E] text-2xl tracking-tight leading-none">
              Files
            </h2>
            <p className="text-xs font-semibold text-[#6B6560] mt-1 tracking-wide uppercase">
              {workspaceName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-[#F5EAD8] flex items-center justify-center transition-colors group"
          >
            <X
              size={20}
              className="text-[#6B6560] group-hover:text-[#1A1A2E]"
            />
          </button>
        </div>

        {/* Section 2: Drive Connection & Upload Area */}
        <div className="px-8 py-6 border-b border-[#E8DDD0] bg-[#F5EAD8]/40">
          {filesWorkspaceData === null ? (
            <div className="flex justify-center py-4">
              <Loader2 size={24} className="animate-spin text-[#244e8a]" />
            </div>
          ) : !isDriveConnected ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <LinkIcon size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-[#1A1A2E] font-bold">
                  Google Drive not connected
                </p>
                <p className="text-sm text-[#6B6560] mt-1">
                  Files for this workspace are stored securely in Google Drive.
                </p>
              </div>
              {isFilesOwner ? (
                <button
                  onClick={handleConnectDrive}
                  className="bg-[#244e8a] text-white rounded-xl px-6 py-2.5 text-sm font-black hover:bg-[#1d3f70] transition-all shadow-lg shadow-blue-900/10 flex items-center gap-2"
                >
                  <LinkIcon size={16} /> Connect Google Drive
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-white/50 rounded-xl border border-[#E8DDD0]">
                  <Loader2 size={14} className="animate-spin text-[#6B6560]" />
                  <p className="text-xs text-[#6B6560] font-medium italic">
                    Waiting for the workspace owner to connect Google Drive...
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-[#1A1A2E] uppercase tracking-[0.15em]">
                  Upload a file
                </p>
                <p className="text-[10px] text-[#6B6560] font-medium mt-0.5">
                  Max file size 50MB
                </p>
              </div>
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-[#244e8a] text-white rounded-xl px-6 py-2.5 text-sm font-black hover:bg-[#1d3f70] transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-900/10"
                >
                  {uploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {uploading ? "Uploading..." : "Upload File"}
                </button>
              </div>
            </div>
          )}
          {filesSuccess && (
            <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-100 rounded-xl">
              <CheckCircle size={14} className="text-green-600" />
              <p className="text-xs text-green-700 font-bold">{filesSuccess}</p>
            </div>
          )}
          {filesError && (
            <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-xl">
              <X size={14} className="text-red-600" />
              <p className="text-xs text-red-700 font-bold">{filesError}</p>
            </div>
          )}
        </div>

        {/* Section 3: File List */}
        <div className="px-8 py-6 max-h-[400px] overflow-y-auto">
          <div className="flex items-center justify-between mb-4 border-b border-[#E8DDD0] pb-2">
            <p className="text-[10px] font-black text-[#1A1A2E] uppercase tracking-[0.2em]">
              Files ({workspaceFiles.length})
            </p>
          </div>

          {filesLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={32} className="animate-spin text-[#244e8a]" />
              <p className="text-xs font-bold text-[#6B6560] uppercase tracking-widest">
                Fetching your files...
              </p>
            </div>
          ) : workspaceFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center opacity-60">
              <Folder size={40} className="text-[#E8DDD0] mb-3" />
              <p className="text-sm font-semibold text-[#1A1A2E]">
                No files uploaded yet.
              </p>
              <p className="text-xs text-[#6B6560] mt-1">
                Connect Drive or upload a file to get started.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {workspaceFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between py-3 px-4 rounded-2xl hover:bg-[#F5EAD8]/60 border border-transparent hover:border-[#E8DDD0] transition-all group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#E8DDD0] flex items-center justify-center text-xl shrink-0 shadow-sm transition-transform group-hover:scale-105">
                      {getFileIcon(f.mimeType)}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold text-[#1A1A2E] truncate max-w-[280px]"
                        title={f.name}
                      >
                        {f.name}
                      </p>
                      <p className="text-[11px] text-[#6B6560] font-semibold flex items-center gap-1.5 mt-0.5">
                        {formatFileSize(f.size)}
                        {f.size && f.createdTime && (
                          <span className="w-1 h-1 rounded-full bg-[#E8DDD0]" />
                        )}
                        {f.createdTime
                          ? new Date(f.createdTime).toLocaleDateString(
                              undefined,
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    {f.webViewLink && (
                      <a
                        href={f.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-9 h-9 rounded-xl border border-[#E8DDD0] bg-white hover:bg-[#244e8a] hover:text-white flex items-center justify-center transition-all shadow-sm"
                        title="Preview"
                      >
                        <Eye size={15} />
                      </a>
                    )}
                    {f.webContentLink && (
                      <button
                        onClick={() => handleFileDownload(f.id, f.name)}
                        className="w-9 h-9 rounded-xl border border-[#E8DDD0] bg-white hover:bg-[#244e8a] hover:text-white flex items-center justify-center transition-all shadow-sm"
                        title="Download"
                      >
                        <Download size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => handleFileDelete(f.id)}
                      className="w-9 h-9 rounded-xl border border-[#E8DDD0] bg-white hover:bg-red-500 hover:text-white flex items-center justify-center transition-all shadow-sm"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: Footer */}
        <div className="px-8 py-4 border-t border-[#E8DDD0] bg-[#F5EAD8]/20 flex justify-end">
          <button
            onClick={onClose}
            className="bg-white border border-[#E8DDD0] text-[#1A1A2E] rounded-xl px-6 py-2 text-sm font-bold hover:bg-[#F5EAD8] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
