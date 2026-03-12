/**
 * classifyStroke.js – Heuristic auto-shape recognition orchestrator
 */

import { rdpSimplify } from "./rdp.js";
import {
  computeBounds,
  boundsDiagonal,
  boundsCenter,
  pathLength,
  dist,
  radiusStats,
} from "./pointUtils.js";
import * as T from "./thresholds.js";

// Import modular detectors
import { detectSquare } from "./detectors/SquareDetector.js";
import { detectTriangle } from "./detectors/TriangleDetector.js";
import { detectCircle } from "./detectors/CircleDetector.js";

/**
 * @typedef {Object} DetectionResult
 * @property {"square"|"rectangle"|"triangle"|"circle"|null} kind
 * @property {number} confidence - 0–1
 * @property {Object} debug - diagnostic info for tuning
 */

/**
 * Classify a completed pen stroke by orchestrating specialized detectors.
 *
 * @param {{ x: number, y: number, pressure?: number }[]} points - raw stroke
 * @returns {DetectionResult}
 */
export function classifyStroke(points) {
  const emptyDebug = {
    closed: false, closureRatio: 1, simplifiedCount: 0,
    aspectRatio: 0, radiusVariance: 1, cornerCount: 0,
    angles: [], bounds: { x: 0, y: 0, w: 0, h: 0 },
  };

  if (!points || points.length < T.MIN_POINTS) {
    return { kind: null, confidence: 0, debug: { ...emptyDebug, reason: "too few points" } };
  }

  const bounds = computeBounds(points);
  const diagonal = boundsDiagonal(bounds);

  if (diagonal < T.MIN_DIAGONAL) {
    return { kind: null, confidence: 0, debug: { ...emptyDebug, bounds, reason: "too small" } };
  }

  const closed = dist(points[0], points[points.length - 1]) / diagonal <= T.CLOSURE_MAX_GAP_RATIO
              || dist(points[0], points[points.length - 1]) / pathLength(points) <= T.CLOSURE_MAX_GAP_PATH_RATIO;

  if (!closed) {
    return { kind: null, confidence: 0, debug: { ...emptyDebug, bounds, closed: false, reason: "not closed" } };
  }

  const simplified = rdpSimplify(points, T.RDP_EPSILON);
  let vertices = [...simplified];
  if (vertices.length > 2 && dist(vertices[0], vertices[vertices.length - 1]) < diagonal * 0.15) {
    vertices = vertices.slice(0, -1);
  }

  const center = boundsCenter(bounds);
  const aspectRatio = Math.min(bounds.w, bounds.h) / Math.max(bounds.w, bounds.h);
  const rStats = radiusStats(points, center);

  const sharedDebug = {
    closed: true,
    simplifiedCount: vertices.length,
    aspectRatio,
    radiusVariance: rStats.normalizedVariance,
    bounds,
  };

  // Run detectors in priority order
  const quad = detectSquare(vertices, diagonal, sharedDebug);
  if (quad) return quad;

  const tri = detectTriangle(vertices, diagonal, sharedDebug);
  if (tri) return tri;

  const circ = detectCircle(vertices, rStats, sharedDebug);
  if (circ) return circ;

  return { kind: null, confidence: 0, debug: { ...sharedDebug, reason: "no match" } };
}
