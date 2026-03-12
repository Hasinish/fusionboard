import React from "react";

/**
 * Eraser trail SVG
 */
export function EraserTrailOverlay({ eraserPath, camera }) {
    if (!eraserPath || eraserPath.length < 2) return null;
    const d = eraserPath.map((p, i) => {
        const sx = p.x * camera.z + camera.x;
        const sy = p.y * camera.z + camera.y;
        return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
    }).join(" ");

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 16, overflow: "visible" }}
        >
            <path d={d} fill="none" stroke="rgba(239,68,68,0.4)" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />
        </svg>
    );
}

export default EraserTrailOverlay;
