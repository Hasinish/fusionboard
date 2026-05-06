import React from "react";
import getStroke from "perfect-freehand";
import { getSvgPathFromStroke, getPathBounds } from "./geometryUtils";

/** Shape SVG renderer */
export function ShapeSVG({ type, fill, stroke, strokeWidth, w, h }) {
    const sW = strokeWidth || 2; // Named sW to avoid conflict with width w
    if (type === "rect") {
        return (
            <svg width={w} height={h} className="absolute inset-0 pointer-events-none">
                <rect x={sW / 2} y={sW / 2} width={Math.max(0, w - sW)} height={Math.max(0, h - sW)} rx="8" fill={fill} stroke={stroke} strokeWidth={sW} />
            </svg>
        );
    }
    if (type === "ellipse") {
        return (
            <svg width={w} height={h} className="absolute inset-0 pointer-events-none">
                <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - sW / 2)} ry={Math.max(0, h / 2 - sW / 2)} fill={fill} stroke={stroke} strokeWidth={sW} />
            </svg>
        );
    }
    if (type === "triangle") {
        const pts = `${w / 2},${sW} ${w - sW},${h - sW} ${sW},${h - sW}`;
        return (
            <svg width={w} height={h} className="absolute inset-0 pointer-events-none">
                <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sW} strokeLinejoin="round" />
            </svg>
        );
    }
    if (type === "arrow") {
        const arrowHeadSize = 12;
        return (
            <svg width={w} height={h} className="absolute inset-0 pointer-events-none">
                <line x1={sW} y1={h / 2} x2={w - arrowHeadSize} y2={h / 2} stroke={stroke} strokeWidth={sW} strokeLinecap="round" />
                <polygon points={`${w - sW},${h / 2} ${w - arrowHeadSize},${h / 2 - arrowHeadSize / 2} ${w - arrowHeadSize},${h / 2 + arrowHeadSize / 2}`} fill={stroke} />
            </svg>
        );
    }
    if (type === "line") {
        return (
            <svg width={w} height={h} className="absolute inset-0 pointer-events-none" style={{ overflow: "visible" }}>
                <path 
                    d={`M 0 ${h / 2} L ${w} ${h / 2}`} 
                    stroke={stroke || (type === "line" ? "#000" : "none")} 
                    strokeWidth={sW} 
                    strokeLinecap="round" 
                    fill="none"
                />
            </svg>
        );
    }
    if (type === "text") return null; // Text elements have no shape background
    if (type === "path") return null; // Path elements render via PathSVG below
    return null;
}

/** Vector path SVG renderer (for pen strokes) */
export function PathSVG({ el, sw, sh }) {
    if (!el.points || el.points.length === 0) return null;

    // We need to translate world points relative to the element's bounding box
    // because the SVG is positioned at (el.x, el.y) by the parent wrapper
    const bounds = getPathBounds(el.points);
    const scaleX = sw / (bounds.w || 1);
    const scaleY = sh / (bounds.h || 1);

    // If path only has a single point (a dot click without dragging)
    if (el.points.length === 1) {
        const radius = (el.width || 2) * Math.min(scaleX, scaleY);
        const p = el.points[0];
        const cx = (p.x - bounds.x) * scaleX;
        const cy = (p.y - bounds.y) * scaleY;
        return (
            <svg width={sw} height={sh} className="absolute inset-0 pointer-events-none" style={{ overflow: "visible" }}>
                <circle cx={cx} cy={cy} r={radius} fill={el.color || "#000"} />
            </svg>
        );
    }

    const outlinePoints = getStroke(
        el.points.map(p => [
            (p.x - bounds.x) * scaleX,
            (p.y - bounds.y) * scaleY,
            p.pressure || 0.5
        ]),
        {
            size: (el.width || 2) * 2 * Math.min(scaleX, scaleY),
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
            last: true, // Ensuring perfect-freehand tries to close the path
        }
    );

    const pathData = getSvgPathFromStroke(outlinePoints);
    if (!pathData) return null;

    return (
        <svg width={sw} height={sh} className="absolute inset-0 pointer-events-none" style={{ overflow: "visible" }}>
            <path d={pathData} fill={el.color || "#000"} stroke="none" />
        </svg>
    );
}
