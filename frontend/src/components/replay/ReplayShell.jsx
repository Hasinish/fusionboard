import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ReplayShell({ 
  children, 
  title, 
  date, 
  duration, 
  isDark, 
  controls 
}) {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const hideTimerRef = useRef(null);

  const resetTimer = () => {
    setIsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 4000); // 4 seconds of inactivity
  };

  useEffect(() => {
    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("mousedown", resetTimer);
    window.addEventListener("keydown", resetTimer);
    
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("mousedown", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <div className={`w-screen h-screen ${isDark ? "bg-[#121212] text-white" : "bg-[#F0F0F0] text-black"} overflow-hidden relative flex flex-col font-sans cursor-normal ${!isVisible ? "cursor-none" : ""}`}>
      {/* Header Overlay */}
      <div className={`absolute top-0 left-0 right-0 h-24 bg-gradient-to-b ${isDark ? "from-black/90" : "from-white/90"} to-transparent flex items-center justify-between px-8 z-50 pointer-events-none transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}>
        <div className="flex items-center gap-5 pointer-events-auto">
          <button 
            onClick={() => navigate(-1)}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-black/10 hover:bg-black/20"} transition-all active:scale-90 backdrop-blur-md border border-white/10 shadow-xl`}
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black tracking-tight leading-tight">{title || "Replay Session"}</h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${isDark ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-blue-100 text-blue-600 border border-blue-200"}`}>
                Recording
              </span>
            </div>
            <p className={`text-xs ${isDark ? "text-white/40" : "text-black/40"} font-black uppercase tracking-widest mt-0.5`}>
               {date} • {duration}
            </p>
          </div>
        </div>

        {/* Playback Badge */}
        <div className={`pointer-events-auto flex items-center gap-3 ${isDark ? "bg-black/40 border-white/10" : "bg-white/60 border-black/10"} backdrop-blur-xl px-5 py-2.5 rounded-full border shadow-2xl transition-all hover:rotate-1`}>
          <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_12px_rgba(220,38,38,0.8)]" />
          <span className="text-[11px] font-black uppercase tracking-[0.25em]">Live Playback</span>
        </div>
      </div>

      {/* Main Content (Canvas) */}
      <div className="flex-1 relative">
        {children}
      </div>

      {/* Controls Overlay */}
      <div className={`absolute bottom-10 left-0 right-0 flex justify-center px-8 z-50 pointer-events-none transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}`}>
        <div className="w-full max-w-5xl pointer-events-auto drop-shadow-2xl">
          {controls}
        </div>
      </div>
    </div>
  );
}
