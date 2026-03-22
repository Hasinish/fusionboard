// ── Line-segment vs AABB intersection (for eraser on shapes) ────────────────
export function lineIntersectsAABB(x1, y1, x2, y2, rx, ry, rw, rh) {
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
    const code = (x, y) => {
        let c = INSIDE;
        if (x < rx) c |= LEFT; else if (x > rx + rw) c |= RIGHT;
        if (y < ry) c |= TOP; else if (y > ry + rh) c |= BOTTOM;
        return c;
    };
    let c1 = code(x1, y1), c2 = code(x2, y2);
    while (true) {
        if (!(c1 | c2)) return true;
        if (c1 & c2) return false;
        const cout = c1 || c2;
        let x, y;
        if (cout & BOTTOM) { x = x1 + (x2 - x1) * (ry + rh - y1) / (y2 - y1); y = ry + rh; }
        else if (cout & TOP) { x = x1 + (x2 - x1) * (ry - y1) / (y2 - y1); y = ry; }
        else if (cout & RIGHT) { y = y1 + (y2 - y1) * (rx + rw - x1) / (x2 - x1); x = rx + rw; }
        else { y = y1 + (y2 - y1) * (rx - x1) / (x2 - x1); x = rx; }
        if (cout === c1) { x1 = x; y1 = y; c1 = code(x1, y1); }
        else { x2 = x; y2 = y; c2 = code(x2, y2); }
    }
}

// ── Minimum distance from point to a line segment ───────────────────────────
export function pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ── Minimum distance between two line segments ──────────────────────────────
export function segmentToSegmentDist(ax, ay, bx, by, cx, cy, dx2, dy2) {
    // Check if segments actually intersect (distance = 0)
    const d1x = bx - ax, d1y = by - ay;
    const d2x = dx2 - cx, d2y = dy2 - cy;
    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) > 1e-10) {
        const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
        const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
    }
    // Otherwise compute min distance of endpoints to opposite segment
    return Math.min(
        pointToSegmentDist(ax, ay, cx, cy, dx2, dy2),
        pointToSegmentDist(bx, by, cx, cy, dx2, dy2),
        pointToSegmentDist(cx, cy, ax, ay, bx, by),
        pointToSegmentDist(dx2, dy2, ax, ay, bx, by)
    );
}

/** 
 * Check if eraser segment hits an element
 * Note: Depends on several localized math helpers extracted from TestInfiniteCanvas
 */
export function eraserHitsElement(ex1, ey1, ex2, ey2, el) {
    if (el.type === "path" && el.points && el.points.length >= 2) {
        // For path elements, test against each actual polyline segment
        const tolerance = Math.max(8, (el.width || 2) * 1.5);
        for (let i = 0; i < el.points.length - 1; i++) {
            const a = el.points[i], b = el.points[i + 1];
            const dist = segmentToSegmentDist(ex1, ey1, ex2, ey2, a.x, a.y, b.x, b.y);
            if (dist <= tolerance) return true;
        }
        return false;
    }

    const { x, y, w, h } = el;
    const sW = el.strokeWidth || 2;
    const tol = Math.max(8, sW * 1.5);

    // Account for rotation by transforming the eraser segment into the element's local space
    let lex1 = ex1, ley1 = ey1, lex2 = ex2, ley2 = ey2;
    if (el.rotation) {
        const rad = (-el.rotation * Math.PI) / 180; // Negative rotation for local space
        const cx = x + w / 2;
        const cy = y + h / 2;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const tx1 = ex1 - cx, ty1 = ey1 - cy;
        lex1 = cx + (tx1 * cos - ty1 * sin);
        ley1 = cy + (tx1 * sin + ty1 * cos);

        const tx2 = ex2 - cx, ty2 = ey2 - cy;
        lex2 = cx + (tx2 * cos - ty2 * sin);
        ley2 = cy + (tx2 * sin + ty2 * cos);
    }

    // For transparent/unfilled shapes, check intersection against the precise perimeter geometry in local space
    const isUnfilled = el.fill === "transparent" || el.fill === "none";
    if (isUnfilled) {
        if (el.type === "rect") {
            return (
                segmentToSegmentDist(lex1, ley1, lex2, ley2, x, y, x + w, y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, x, y + h, x + w, y + h) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, x, y, x, y + h) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, x + w, y, x + w, y + h) <= tol
            );
        }

        if (el.type === "triangle") {
            const v1 = { x: x + w / 2, y: y + sW };
            const v2 = { x: x + w - sW, y: y + h - sW };
            const v3 = { x: x + sW, y: y + h - sW };
            return (
                segmentToSegmentDist(lex1, ley1, lex2, ley2, v1.x, v1.y, v2.x, v2.y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, v2.x, v2.y, v3.x, v3.y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, v3.x, v3.y, v1.x, v1.y) <= tol
            );
        }

        if (el.type === "arrow") {
            const arrowHeadSize = 12;
            const shaftStart = { x: x + sW, y: y + h / 2 };
            const shaftEnd = { x: x + w - arrowHeadSize, y: y + h / 2 };
            const headTip = { x: x + w - sW, y: y + h / 2 };
            const headUpper = { x: x + w - arrowHeadSize, y: y + h / 2 - arrowHeadSize / 2 };
            const headLower = { x: x + w - arrowHeadSize, y: y + h / 2 + arrowHeadSize / 2 };
            return (
                segmentToSegmentDist(lex1, ley1, lex2, ley2, shaftStart.x, shaftStart.y, shaftEnd.x, shaftEnd.y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, headTip.x, headTip.y, headUpper.x, headUpper.y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, headTip.x, headTip.y, headLower.x, headLower.y) <= tol ||
                segmentToSegmentDist(lex1, ley1, lex2, ley2, headUpper.x, headUpper.y, headLower.x, headLower.y) <= tol
            );
        }

        if (el.type === "ellipse") {
            const cx = x + w / 2, cy = y + h / 2;
            const rx = Math.max(0, w / 2 - sW / 2);
            const ry = Math.max(0, h / 2 - sW / 2);
            const segments = 32;
            for (let i = 0; i < segments; i++) {
                const a1 = (i / segments) * Math.PI * 2;
                const a2 = ((i + 1) / segments) * Math.PI * 2;
                const dist = segmentToSegmentDist(lex1, ley1, lex2, ley2,
                    cx + Math.cos(a1) * rx, cy + Math.sin(a1) * ry,
                    cx + Math.cos(a2) * rx, cy + Math.sin(a2) * ry
                );
                if (dist <= tol) return true;
            }
            return false;
        }
    }

    // For solid shapes (or sticky notes), use full footprint/AABB intersection in local space
    return lineIntersectsAABB(lex1, ley1, lex2, ley2, x, y, w, h);
}

