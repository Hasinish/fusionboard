/**
 * rdp.js – Ramer-Douglas-Peucker stroke simplification
 *
 * Pure function, zero dependencies.
 * Works on points shaped { x, y, pressure? }.
 */

/**
 * Perpendicular distance from point `p` to the line segment `start→end`.
 * @param {{ x: number, y: number }} p
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} end
 * @returns {number}
 */
function perpendicularDistance(p, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(p.x - start.x, p.y - start.y);
  }

  const t = ((p.x - start.x) * dx + (p.y - start.y) * dy) / lenSq;
  const clamped = Math.max(0, Math.min(1, t));
  const projX = start.x + clamped * dx;
  const projY = start.y + clamped * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Remove near-duplicate sequential points (distance < `minDist`).
 * Always preserves the first and last point.
 *
 * @param {{ x: number, y: number }[]} points
 * @param {number} [minDist=1] - minimum pixel distance between consecutive points
 * @returns {{ x: number, y: number }[]}
 */
export function deduplicateSequential(points, minDist = 1) {
  if (points.length <= 2) return points;

  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const dx = points[i].x - prev.x;
    const dy = points[i].y - prev.y;
    if (dx * dx + dy * dy >= minDist * minDist) {
      result.push(points[i]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Ramer-Douglas-Peucker simplification.
 *
 * Reduces a polyline to fewer vertices while preserving overall shape.
 * Deduplicates near-sequential points first.
 *
 * @param {{ x: number, y: number, pressure?: number }[]} points - input stroke
 * @param {number} [epsilon=2] - perpendicular distance tolerance (world px)
 * @returns {{ x: number, y: number, pressure?: number }[]} simplified points
 */
export function rdpSimplify(points, epsilon = 2) {
  if (!points || points.length <= 2) return points || [];

  const cleaned = deduplicateSequential(points, 1);
  if (cleaned.length <= 2) return cleaned;

  return rdpRecurse(cleaned, 0, cleaned.length - 1, epsilon);
}

/**
 * Recursive core of the RDP algorithm.
 */
function rdpRecurse(pts, start, end, epsilon) {
  if (end - start < 2) {
    return [pts[start], pts[end]];
  }

  let maxDist = 0;
  let maxIdx = start;

  for (let i = start + 1; i < end; i++) {
    const d = perpendicularDistance(pts[i], pts[start], pts[end]);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpRecurse(pts, start, maxIdx, epsilon);
    const right = rdpRecurse(pts, maxIdx, end, epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [pts[start], pts[end]];
}
