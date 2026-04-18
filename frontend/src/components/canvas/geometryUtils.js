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
 * @param cameraZ Zoom level
 */
export function pointHitsElement(wx, wy, el, cameraZ = 1) {
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

    // Mathematical padding: 4 screen pixels of tolerance, converted to world space.
    // Plus half the stroke width, so the "center line" math expands out to cover the stroke itself.
    const screenPadding = 4;
    const hitThreshold = ((el.strokeWidth || 2) / 2) + (screenPadding / cameraZ);

    // ── Freehand paths: always stroke-only ──
    if (el.type === "path") {
        const points = el.points || [];
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            if (getDistToSegment(px, py, p1.x, p1.y, p2.x, p2.y) < hitThreshold) return true;
        }
        return false;
    }

    // ── Ellipse: stroke-only (distance from ellipse perimeter) ──
    if (el.type === "ellipse") {
        const sW = el.strokeWidth || 2;
        const rx = Math.max(0.1, el.w / 2 - sW / 2);
        const ry = Math.max(0.1, el.h / 2 - sW / 2);
        const cx = el.x + el.w / 2;
        const cy = el.y + el.h / 2;
        
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return false;
        const angle = Math.atan2(dy, dx);
        const eRadius = (rx * ry) / Math.sqrt((ry * Math.cos(angle)) ** 2 + (rx * Math.sin(angle)) ** 2);
        return Math.abs(dist - eRadius) <= hitThreshold;
    }

    // ── Triangle: stroke-only (distance from edges) ──
    if (el.type === "triangle") {
        const sW = el.strokeWidth || 2;
        const x1 = el.x + el.w / 2, y1 = el.y + sW;
        const x2 = el.x + el.w - sW, y2 = el.y + el.h - sW;
        const x3 = el.x + sW, y3 = el.y + el.h - sW;
        const d1 = getDistToSegment(px, py, x1, y1, x2, y2);
        const d2 = getDistToSegment(px, py, x2, y2, x3, y3);
        const d3 = getDistToSegment(px, py, x3, y3, x1, y1);
        return d1 < hitThreshold || d2 < hitThreshold || d3 < hitThreshold;
    }

    // ── Rectangle: stroke-only (distance from edges) ──
    if (el.type === "rect") {
        const sW = el.strokeWidth || 2;
        // SVG renders rect at [sW/2, sW/2, w - sW, h - sW].
        // So the mathematical center line of the stroke is exact:
        const minX = el.x + sW / 2;
        const minY = el.y + sW / 2;
        const maxX = el.x + el.w - sW / 2;
        const maxY = el.y + el.h - sW / 2;
        
        // Quick bounding box pre-check with threshold padding
        if (px < minX - hitThreshold || px > maxX + hitThreshold ||
            py < minY - hitThreshold || py > maxY + hitThreshold) return false;

        // Rounded corners: radius = 8
        const r = 8;
        if (px < minX + r && py < minY + r) {
            // Top-left corner
            const dist = Math.sqrt((px - (minX + r)) ** 2 + (py - (minY + r)) ** 2);
            return Math.abs(dist - r) <= hitThreshold;
        } else if (px > maxX - r && py < minY + r) {
            // Top-right corner
            const dist = Math.sqrt((px - (maxX - r)) ** 2 + (py - (minY + r)) ** 2);
            return Math.abs(dist - r) <= hitThreshold;
        } else if (px > maxX - r && py > maxY - r) {
            // Bottom-right corner
            const dist = Math.sqrt((px - (maxX - r)) ** 2 + (py - (maxY - r)) ** 2);
            return Math.abs(dist - r) <= hitThreshold;
        } else if (px < minX + r && py > maxY - r) {
            // Bottom-left corner
            const dist = Math.sqrt((px - (minX + r)) ** 2 + (py - (maxY - r)) ** 2);
            return Math.abs(dist - r) <= hitThreshold;
        }

        // Straight segments
        const dLeft   = getDistToSegment(px, py, minX, minY + r, minX, maxY - r);
        const dRight  = getDistToSegment(px, py, maxX, minY + r, maxX, maxY - r);
        const dTop    = getDistToSegment(px, py, minX + r, minY, maxX - r, minY);
        const dBottom = getDistToSegment(px, py, minX + r, maxY, maxX - r, maxY);
        return dLeft < hitThreshold || dRight < hitThreshold || dTop < hitThreshold || dBottom < hitThreshold;
    }

    // ── Arrow: precise shaft + head ──
    if (el.type === "arrow") {
        const headSize = 12;
        // Shaft line
        if (getDistToSegment(px, py, el.x, el.y + el.h / 2, el.x + el.w - headSize, el.y + el.h / 2) < hitThreshold) return true;
        // Head triangle
        return pointInTriangle(px, py,
            el.x + el.w, el.y + el.h / 2,
            el.x + el.w - headSize, el.y + el.h / 2 - headSize / 2,
            el.x + el.w - headSize, el.y + el.h / 2 + headSize / 2
        );
    }

    // ── Content types (sticky, text, code, video, graph): full bounding-box selection ──
    const pad = el.type === "text" ? 5 : 0;
    return px >= el.x - pad && px <= el.x + el.w + pad && py >= el.y - pad && py <= el.y + el.h + pad;
}

function lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den === 0) return false;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function segmentIntersectsBox(px1, py1, px2, py2, boxX1, boxY1, boxX2, boxY2) {
    if ((px1 >= boxX1 && px1 <= boxX2 && py1 >= boxY1 && py1 <= boxY2) ||
        (px2 >= boxX1 && px2 <= boxX2 && py2 >= boxY1 && py2 <= boxY2)) return true;
    return lineIntersectsLine(px1, py1, px2, py2, boxX1, boxY1, boxX2, boxY1) ||
           lineIntersectsLine(px1, py1, px2, py2, boxX1, boxY2, boxX2, boxY2) ||
           lineIntersectsLine(px1, py1, px2, py2, boxX1, boxY1, boxX1, boxY2) ||
           lineIntersectsLine(px1, py1, px2, py2, boxX2, boxY1, boxX2, boxY2);
}

/**
 * Determines if a selection box (x1,y1 to x2,y2) hits an element.
 * Only returns true if the marquee entirely encloses the shape, or physically intersects its outline.
 */
export function boxHitsElement(x1, y1, x2, y2, el) {
    const bounds = getElementBounds(el);
    // 1. Fast AABB rejection
    if (bounds.x > x2 || bounds.x + bounds.w < x1 || bounds.y > y2 || bounds.y + bounds.h < y1) {
        return false;
    }

    // 2. Content types are solid blocks
    if (["sticky", "text", "code", "video", "graph"].includes(el.type)) return true;

    // 3. Fully enclosed?
    if (bounds.x >= x1 && bounds.x + bounds.w <= x2 && bounds.y >= y1 && bounds.y + bounds.h <= y2) {
        return true;
    }

    // 4. Exact outline geometric intersection
    const rotatePoint = (px, py) => {
        if (!el.rotation) return { x: px, y: py };
        const rad = (el.rotation * Math.PI) / 180;
        const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
        const dx = px - cx, dy = py - cy;
        return {
            x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
            y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
        };
    };

    if (el.type === "path") {
        const points = el.points || [];
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = rotatePoint(points[i].x, points[i].y);
            const p2 = rotatePoint(points[i+1].x, points[i+1].y);
            if (segmentIntersectsBox(p1.x, p1.y, p2.x, p2.y, x1, y1, x2, y2)) return true;
        }
        return false;
    }

    if (el.type === "rect") {
        const p1 = rotatePoint(el.x, el.y);
        const p2 = rotatePoint(el.x + el.w, el.y);
        const p3 = rotatePoint(el.x + el.w, el.y + el.h);
        const p4 = rotatePoint(el.x, el.y + el.h);
        return segmentIntersectsBox(p1.x, p1.y, p2.x, p2.y, x1, y1, x2, y2) ||
               segmentIntersectsBox(p2.x, p2.y, p3.x, p3.y, x1, y1, x2, y2) ||
               segmentIntersectsBox(p3.x, p3.y, p4.x, p4.y, x1, y1, x2, y2) ||
               segmentIntersectsBox(p4.x, p4.y, p1.x, p1.y, x1, y1, x2, y2);
    }

    if (el.type === "triangle") {
        const p1 = rotatePoint(el.x + el.w / 2, el.y); 
        const p2 = rotatePoint(el.x + el.w, el.y + el.h);
        const p3 = rotatePoint(el.x, el.y + el.h);
        return segmentIntersectsBox(p1.x, p1.y, p2.x, p2.y, x1, y1, x2, y2) ||
               segmentIntersectsBox(p2.x, p2.y, p3.x, p3.y, x1, y1, x2, y2) ||
               segmentIntersectsBox(p3.x, p3.y, p1.x, p1.y, x1, y1, x2, y2);
    }

    if (el.type === "arrow") {
        const headSize = 12;
        const p1 = rotatePoint(el.x, el.y + el.h / 2);
        const p2 = rotatePoint(el.x + el.w, el.y + el.h / 2);
        const h1 = rotatePoint(el.x + el.w - headSize, el.y + el.h / 2 - headSize / 2);
        const h2 = rotatePoint(el.x + el.w - headSize, el.y + el.h / 2 + headSize / 2);
        return segmentIntersectsBox(p1.x, p1.y, p2.x, p2.y, x1, y1, x2, y2) ||
               segmentIntersectsBox(p2.x, p2.y, h1.x, h1.y, x1, y1, x2, y2) ||
               segmentIntersectsBox(h1.x, h1.y, h2.x, h2.y, x1, y1, x2, y2) ||
               segmentIntersectsBox(h2.x, h2.y, p2.x, p2.y, x1, y1, x2, y2);
    }

    if (el.type === "ellipse") {
        const steps = 16;
        let lastP = null;
        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const px = el.x + el.w/2 + (el.w/2) * Math.cos(angle);
            const py = el.y + el.h/2 + (el.h/2) * Math.sin(angle);
            const p = rotatePoint(px, py);
            if (lastP && segmentIntersectsBox(lastP.x, lastP.y, p.x, p.y, x1, y1, x2, y2)) return true;
            lastP = p;
        }
        return false;
    }

    return false;
}
