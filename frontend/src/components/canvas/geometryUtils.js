/** perfect-freehand helper: converts stroke points to SVG path data */
export function getSvgPathFromStroke(stroke) {
    if (!stroke.length) return "";
    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ["M", ...stroke[0], "Q"]
    );
    d.push("Z");
    return d.join(" ");
}

/** Calculates the bounding box of a collection of points */
export function getPathBounds(points) {
    if (!points || !points.length) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        const px = p?.x ?? p?.[0] ?? 0;
        const py = p?.y ?? p?.[1] ?? 0;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
    }
    if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
    const pad = 4;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

/** Calculates the world-space bounding box for any element type */
export function getElementBounds(el) {
    if (!el) return { x: 0, y: 0, w: 0, h: 0 };
    if (el.type === "path") {
        return getPathBounds(el.points || []);
    }

    // For shapes with rotation, calculate the AABB of the rotated corners
    if (el.rotation) {
        const rad = (el.rotation * Math.PI) / 180;
        const cx = el.x + (el.w || 0) / 2;
        const cy = el.y + (el.h || 0) / 2;

        const corners = [
            { x: el.x || 0, y: el.y || 0 },
            { x: (el.x || 0) + (el.w || 0), y: el.y || 0 },
            { x: el.x || 0, y: (el.y || 0) + (el.h || 0) },
            { x: (el.x || 0) + (el.w || 0), y: (el.y || 0) + (el.h || 0) }
        ];

        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        corners.forEach(p => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            const rx = cx + (dx * cos - dy * sin);
            const ry = cy + (dx * sin + dy * cos);
            minX = Math.min(minX, rx);
            minY = Math.min(minY, ry);
            maxX = Math.max(maxX, rx);
            maxY = Math.max(maxY, ry);
        });

        if (minX === Infinity) return { x: el.x || 0, y: el.y || 0, w: el.w || 0, h: el.h || 0 };
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }

    return { x: el.x || 0, y: el.y || 0, w: el.w || 0, h: el.h || 0 };
}

/** Minimum distance from a point to a line segment */
export function getDistToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2);
}

/** Boolean check if point is inside a triangle */
export function pointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
    const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
    const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
    const has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(has_neg && has_pos);
}

/** 
 * Precise hit detection for different shape types.
 * @param wx World X
 * @param wy World Y
 * @param el Element object
 */
export function pointHitsElement(wx, wy, el) {
    // 1. Transform point to local space if rotated
    let px = wx;
    let py = wy;
    if (el.rotation) {
        const rad = (-el.rotation * Math.PI) / 180;
        const cx = el.x + el.w / 2;
        const cy = el.y + el.h / 2;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = wx - cx;
        const dy = wy - cy;
        px = cx + (dx * cos - dy * sin);
        py = cy + (dx * sin + dy * cos);
    }

    // 2. Per-type precision check
    if (el.type === "path") {
        const points = el.points || [];
        const threshold = (el.width || 2) + 5;
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            if (getDistToSegment(px, py, p1.x, p1.y, p2.x, p2.y) < threshold) return true;
        }
        return false;
    }

    if (el.type === "ellipse") {
        const rx = el.w / 2;
        const ry = el.h / 2;
        const cx = el.x + rx;
        const cy = el.y + ry;
        if (rx <= 0 || ry <= 0) return false;
        return ((px - cx) ** 2) / (rx ** 2) + ((py - cy) ** 2) / (ry ** 2) <= 1;
    }

    if (el.type === "triangle") {
        const sW = el.strokeWidth || 2;
        return pointInTriangle(px, py,
            el.x + el.w / 2, el.y + sW,
            el.x + el.w - sW, el.y + el.h - sW,
            el.x + sW, el.y + el.h - sW
        );
    }

    if (el.type === "arrow") {
        const sW = el.strokeWidth || 3;
        const headSize = 12;
        // Shaft check (rectangle)
        if (px >= el.x && px <= el.x + el.w - headSize && py >= el.y + el.h / 2 - sW && py <= el.y + el.h / 2 + sW) return true;
        // Head check (triangle)
        return pointInTriangle(px, py,
            el.x + el.w, el.y + el.h / 2,
            el.x + el.w - headSize, el.y + el.h / 2 - headSize / 2,
            el.x + el.w - headSize, el.y + el.h / 2 + headSize / 2
        );
    }

    // Default: Rectangle-based HIT for rect, sticky, text (with padding), code, video
    const pad = el.type === "text" ? 5 : 0;
    return px >= el.x - pad && px <= el.x + el.w + pad && py >= el.y - pad && py <= el.y + el.h + pad;
}
