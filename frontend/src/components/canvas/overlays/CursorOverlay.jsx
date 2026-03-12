import React from "react";

/**
 * Remote cursors overlay
 */
export function CursorOverlay({ cursors, worldToScreen }) {
    if (!cursors || Object.keys(cursors).length === 0) return null;

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 25 }}>
            {Object.entries(cursors).map(([userId, c]) => {
                const sp = worldToScreen(c.x, c.y);
                return (
                    <div key={userId} style={{ position: "absolute", left: sp.x, top: sp.y, transform: "translate(-6px,-6px)", transition: "none" }}>
                        <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm" style={{ background: c.color }} />
                            <span className="text-[10px] px-2 py-0.5 rounded-full shadow-md whitespace-nowrap font-bold text-white" style={{ backgroundColor: c.color }}>{c.name}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default CursorOverlay;
