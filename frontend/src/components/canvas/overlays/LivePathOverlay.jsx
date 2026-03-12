import getStroke from "perfect-freehand";
import { getSvgPathFromStroke } from "../geometryUtils";

/**
 * Live preview SVG component for the pen stroke being drawn
 */
export function LivePathOverlay({ currentPath, camera }) {
    if (!currentPath || !currentPath.points || currentPath.points.length === 0) return null;

    const outlinePoints = getStroke(currentPath.points.map(p => [p.x, p.y, p.pressure || 0.5]), {
        size: currentPath.width * 2,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
    });

    const pathData = getSvgPathFromStroke(outlinePoints);
    if (!pathData) return null;

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 16, overflow: "visible" }}
        >
            <g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.z})`}>
                <path d={pathData} fill={currentPath.color} stroke="none" opacity={0.85} />
            </g>
        </svg>
    );
}

export default LivePathOverlay;
