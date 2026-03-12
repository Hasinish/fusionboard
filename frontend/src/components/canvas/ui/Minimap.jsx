import React from "react";

export default function Minimap({ 
    isMinimapVisible, 
    minimapCanvasRef, 
    handleMinimapPointer, 
    isDark 
}) {
    if (!isMinimapVisible) return null;

    return (
        <div className={`ui-container bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-lg p-2 pointer-events-auto origin-top-right`}>
            <canvas 
                ref={minimapCanvasRef} 
                className={`w-48 h-32 rounded-xl border cursor-grab active:cursor-grabbing ${isDark ? "border-[#333333]" : "border-base-300"}`} 
                style={{ backgroundColor: isDark ? "#121212" : "#f8fafc" }} 
                onMouseDown={handleMinimapPointer} 
                onMouseMove={handleMinimapPointer} 
                onTouchStart={handleMinimapPointer} 
                onTouchMove={handleMinimapPointer} 
            />
        </div>
    );
}
