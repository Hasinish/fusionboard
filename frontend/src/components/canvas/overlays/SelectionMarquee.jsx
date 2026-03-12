import React from "react";

/**
 * Selection box visual marquee
 */
export function SelectionMarquee({ selectionBox, camera }) {
    if (!selectionBox) return null;

    return (
        <div
            className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none"
            style={{
                left: Math.min(selectionBox.x * camera.z + camera.x, (selectionBox.x + selectionBox.w) * camera.z + camera.x),
                top: Math.min(selectionBox.y * camera.z + camera.y, (selectionBox.y + selectionBox.h) * camera.z + camera.y),
                width: Math.abs(selectionBox.w * camera.z),
                height: Math.abs(selectionBox.h * camera.z),
                zIndex: 40
            }}
        />
    );
}

export default SelectionMarquee;
