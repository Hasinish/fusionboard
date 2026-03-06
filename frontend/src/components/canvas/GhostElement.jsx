import React from "react";
import { ShapeSVG } from "./ShapeRenderers";

/** Ghost Preview while dragging to draw */
export function GhostElement({ ghost, camera }) {
    if (!ghost) return null;
    const sx = ghost.x * camera.z + camera.x;
    const sy = ghost.y * camera.z + camera.y;
    const sw = ghost.w * camera.z;
    const sh = ghost.h * camera.z;
    return (
        <div style={{
            position: "absolute",
            left: sx,
            top: sy,
            width: sw,
            height: sh,
            transform: `rotate(${ghost.rotation || 0}deg)`,
            transformOrigin: "center center",
            zIndex: 25,
            pointerEvents: "none",
            opacity: 0.6
        }}>
            {ghost.type === "sticky" ? (
                <div className="absolute inset-0 rounded-md shadow-md" style={{ backgroundColor: ghost.fill, border: `${ghost.strokeWidth || 2}px solid ${ghost.stroke}` }} />
            ) : (
                <ShapeSVG type={ghost.type} fill={ghost.fill} stroke={ghost.stroke} strokeWidth={ghost.strokeWidth} w={sw} h={sh} />
            )}
        </div>
    );
}
