/**
 * pointUtils.js – Pure geometry helpers for auto-shape detection
 *
 * Every function is deterministic, side-effect free, and
 * operates on plain { x, y } point arrays.
 */

/**
 * Compute the axis-aligned bounding box of a point array.
 * @param {{ x: number, y: number }[]} points
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function computeBounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Diagonal length of a bounding box.
 * @param {{ w: number, h: number }} bounds
 * @returns {number}
 */
export function boundsDiagonal(bounds) {
  return Math.hypot(bounds.w, bounds.h);
}

/**
 * Center point of a bounding box.
 * @param {{ x: number, y: number, w: number, h: number }} bounds
 * @returns {{ x: number, y: number }}
 */
export function boundsCenter(bounds) {
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

/**
 * Total polyline arc-length.
 * @param {{ x: number, y: number }[]} points
 * @returns {number}
 */
export function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/**
 * Euclidean distance between two points.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {number}
 */
export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Angle (in radians) at vertex B in the triangle A-B-C.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b - the vertex
 * @param {{ x: number, y: number }} c
 * @returns {number} angle in radians [0, π]
 */
export function angleBetween(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const cross = ba.x * bc.y - ba.y * bc.x;
  return Math.abs(Math.atan2(cross, dot));
}

/**
 * Compute interior angles at each vertex of a polygon defined by ordered points.
 * Returns angles in radians.
 * @param {{ x: number, y: number }[]} vertices
 * @returns {number[]}
 */
export function polygonAngles(vertices) {
  const n = vertices.length;
  const angles = [];
  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];
    angles.push(angleBetween(prev, curr, next));
  }
  return angles;
}

/**
 * Area of a polygon (shoelace formula, absolute value).
 * @param {{ x: number, y: number }[]} vertices
 * @returns {number}
 */
export function polygonArea(vertices) {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Compute the average and normalized variance of distances from
 * each point to a given center.
 * @param {{ x: number, y: number }[]} points - original stroke points (not simplified)
 * @param {{ x: number, y: number }} center
 * @returns {{ avgRadius: number, variance: number, normalizedVariance: number }}
 */
export function radiusStats(points, center) {
  if (points.length === 0) return { avgRadius: 0, variance: 0, normalizedVariance: 1 };

  let sum = 0;
  const radii = [];
  for (const p of points) {
    const r = Math.hypot(p.x - center.x, p.y - center.y);
    radii.push(r);
    sum += r;
  }
  const avg = sum / radii.length;
  if (avg === 0) return { avgRadius: 0, variance: 0, normalizedVariance: 1 };

  let varSum = 0;
  for (const r of radii) {
    varSum += (r - avg) * (r - avg);
  }
  const variance = varSum / radii.length;
  // Normalized by avg² so it's scale-independent
  const normalizedVariance = variance / (avg * avg);

  return { avgRadius: avg, variance, normalizedVariance };
}

/**
 * Edge lengths between consecutive vertices (closed polygon).
 * @param {{ x: number, y: number }[]} vertices
 * @returns {number[]}
 */
export function edgeLengths(vertices) {
  const lengths = [];
  for (let i = 0; i < vertices.length; i++) {
    const next = vertices[(i + 1) % vertices.length];
    lengths.push(dist(vertices[i], next));
  }
  return lengths;
}

/**
 * Computes the centroid (average) of a set of points.
 */
export function centroid(points) {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  let x = 0, y = 0;
  for (const p of points) { x += p.x; y += p.y; }
  return { x: x / points.length, y: y / points.length };
}
