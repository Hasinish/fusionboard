import React from "react";
import { Mic, Square, Loader2 } from "lucide-react";

export default function RecordButton({ isRecording, status, duration, onStart, onStop, isDark }) {
  const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (status === "saving") {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md ${isDark ? "bg-white/10 border-white/20 text-white/70" : "bg-black/5 border-black/10 text-black/60"}`}>
        <Loader2 size={16} className="animate-spin" />
        <span className="text-xs font-bold uppercase tracking-wider">Saving...</span>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={onStop}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all active:scale-95 group"
        >
          <div className="relative">
            <Square size={16} fill="currentColor" />
            <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-20" />
          </div>
          <span className="text-sm font-bold tabular-nums">{formatDuration(duration)}</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onStart}
      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg border transition-all active:scale-95 group ${
        isDark 
          ? "bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:text-white" 
          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm"
      }`}
    >
      <Mic size={16} className="group-hover:text-red-500 transition-colors" />
      <span className="text-sm font-bold">Record</span>
    </button>
  );
}
