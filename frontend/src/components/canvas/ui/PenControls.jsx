import React from "react";

export default function PenControls({ 
    tool, 
    color, 
    colorRef, 
    colorOpen, 
    setColorOpen, 
    setShapesOpen, 
    setPlusOpen, 
    width, 
    setWidth, 
    isDark, 
    toolbarHeight,
    isToolbarVisible
}) {
    if (tool !== "pen") return null;

    return (
        <div
            className={`ui-container absolute left-1/2 -translate-x-1/2 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-lg px-4 py-2 z-30 flex items-center gap-4 pointer-events-auto transition-all duration-300 scale-90 origin-bottom ${isToolbarVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0 pointer-events-none"}`}
            style={{ bottom: (toolbarHeight * 0.9) + 60 }} // Offset above the scaled toolbar
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
        >
            <div className="relative pointer-events-auto" ref={colorRef}>
                <button
                    className="flex items-center justify-center w-10 h-10 rounded-full shadow-lg cursor-pointer ring-2 ring-offset-2 ring-base-300 hover:ring-primary transition-all active:scale-95"
                    style={{ backgroundColor: color }}
                    onClick={(e) => { e.stopPropagation(); setColorOpen(!colorOpen); setShapesOpen(false); setPlusOpen(false); }}
                />
            </div>
            <input
                type="range"
                min="1"
                max="20"
                value={width}
                onChange={e => setWidth(Number(e.target.value))}
                className={`range range-xs range-primary w-32 ml-3 ${isDark ? "bg-white/10" : ""}`}
            />
        </div>
    );
}
