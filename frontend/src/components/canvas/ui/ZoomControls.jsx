import React from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

export default function ZoomControls({ 
    camera, 
    setCameraInstant, 
    isDark, 
    isMobile 
}) {
    return (
        <div className={`ui-container group bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-lg ${isMobile ? "flex flex-col items-center gap-1 px-2 py-2" : "px-3 py-2 flex items-center gap-1"} pointer-events-auto transition-all hover:bg-white/25`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
        >
            <button 
                className={`btn btn-sm btn-ghost ${isDark ? "text-white" : "text-base-content"} opacity-70 hover:opacity-100 px-2`} 
                title="Zoom Out" 
                onClick={() => {
                    const prev = camera;
                    const nZ = Math.max(0.1, prev.z * 0.9); // Faster step for button
                    const sx = window.innerWidth / 2, sy = window.innerHeight / 2;
                    setCameraInstant({ x: sx - (sx - prev.x) * (nZ / prev.z), y: sy - (sy - prev.y) * (nZ / prev.z), z: nZ });
                }}
            >
                <ZoomOut className="w-4 h-4" />
            </button>

            {!isMobile && (
                <div className="flex items-center w-0 opacity-0 group-hover:w-56 group-hover:opacity-100 transition-all duration-300 ease-in-out pointer-events-none group-hover:pointer-events-auto overflow-hidden">
                    <input 
                        type="range" 
                        min="0.1" 
                        max="10" 
                        step="0.01" 
                        value={camera.z} 
                        onChange={(e) => {
                            const nZ = parseFloat(e.target.value);
                            const prev = camera;
                            const sx = window.innerWidth / 2, sy = window.innerHeight / 2;
                            setCameraInstant({ x: sx - (sx - prev.x) * (nZ / prev.z), y: sy - (sy - prev.y) * (nZ / prev.z), z: nZ });
                        }}
                        className={`custom-zoom-slider w-52 mx-2 ${isDark ? "dark" : ""}`}
                    />
                </div>
            )}

            <button 
                className={`btn btn-sm btn-ghost font-mono text-xs px-2 min-h-0 h-7 ${isDark ? "text-white bg-white/10 hover:bg-white/20" : "text-base-content bg-base-200 hover:bg-base-300"}`} 
                onClick={() => {
                    const prev = camera;
                    const nZ = 1;
                    const sx = window.innerWidth / 2, sy = window.innerHeight / 2;
                    setCameraInstant({ x: sx - (sx - prev.x) * (nZ / prev.z), y: sy - (sy - prev.y) * (nZ / prev.z), z: nZ });
                }}
            >
                {Math.round(camera.z * 100)}%
            </button>
            
            <button 
                className={`btn btn-sm btn-ghost ${isDark ? "text-white" : "text-base-content"} opacity-70 hover:opacity-100 px-2`} 
                title="Zoom In" 
                onClick={() => {
                    const prev = camera;
                    const nZ = Math.min(10, prev.z * 1.1); // Faster step for button
                    const sx = window.innerWidth / 2, sy = window.innerHeight / 2;
                    setCameraInstant({ x: sx - (sx - prev.x) * (nZ / prev.z), y: sy - (sy - prev.y) * (nZ / prev.z), z: nZ });
                }}
            >
                <ZoomIn className="w-4 h-4" />
            </button>
        </div>
    );
}
