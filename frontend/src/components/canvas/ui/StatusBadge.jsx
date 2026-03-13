import React from "react";
import { Map as MapIcon } from "lucide-react";

export default function StatusBadge({ 
    statusMsg, 
    isMinimapVisible, 
    setIsMinimapVisible, 
    isDark, 
    isMobile, 
    ghostBtnClass 
}) {
    return (
        <div className={`ui-container bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-lg px-5 py-2 flex items-center gap-3 pointer-events-auto`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
        >
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse"></div>
            {!isMobile && <span className={`text-sm font-semibold ${isDark ? "text-white opacity-90" : "opacity-60"}`}>{statusMsg || "Ready"}</span>}
            <button className={`btn btn-ghost ${ghostBtnClass} btn-sm btn-circle ${!isMobile ? "ml-2" : ""}`} onClick={() => setIsMinimapVisible(!isMinimapVisible)} title="Toggle Minimap"><MapIcon className="w-4 h-4" /></button>
        </div>
    );
}
