import React from "react";
import getStroke from "perfect-freehand";
import { getSvgPathFromStroke } from "../geometryUtils";

/**
 * Remote live strokes preview
 */
export function RemoteLiveStrokesOverlay({ remoteLiveStrokes, camera }) {
    if (!remoteLiveStrokes || Object.keys(remoteLiveStrokes).length === 0) return null;

    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 9 }}>
            <g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.z})`}>
                {Object.entries(remoteLiveStrokes).map(([uid, stroke]) => {
                    if (!stroke || !stroke.points || stroke.points.length === 0) return null;
                    const outlinePoints = getStroke(stroke.points.map(p => [p.x, p.y, p.pressure || 0.5]), {
                        size: stroke.width * 2,
                        thinning: 0.5,
                        smoothing: 0.5,
                        streamline: 0.5,
                    });
                    const pathData = getSvgPathFromStroke(outlinePoints);
                    if (!pathData) return null;

                    return (
                        <path
                            key={`remote-live-${uid}`}
                            d={pathData}
                            fill={stroke.color}
                            style={{ opacity: 0.8 }}
                        />
                    );
                })}
            </g>
        </svg>
    );
}

export default RemoteLiveStrokesOverlay;
