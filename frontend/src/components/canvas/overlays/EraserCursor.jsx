import React from "react";

/**
 * Custom eraser cursor visual
 */
export function EraserCursor({ tool, mousePos }) {
    if (tool !== "eraser") return null;

    return (
        <div 
            className="absolute pointer-events-none rounded-full border-2 border-red-400 bg-red-500/10" 
            style={{ 
                width: 24, 
                height: 24, 
                left: mousePos.x, 
                top: mousePos.y, 
                transform: "translate(-50%, -50%)", 
                zIndex: 20 
            }} 
        />
    );
}

export default EraserCursor;
