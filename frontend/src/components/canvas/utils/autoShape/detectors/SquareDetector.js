import { polygonAngles, edgeLengths } from "../pointUtils.js";
import { reduceToN } from "./detectorUtils.js";
import * as T from "../thresholds.js";

/**
 * @param {{ x: number, y: number }[]} vertices
 * @param {number} diagonal
 * @param {Object} sharedDebug
 * @returns {Object|null}
 */
export function detectSquare(vertices, diagonal, sharedDebug) {
  const n = vertices.length;
  if (n < T.QUAD_MIN_VERTICES || n > T.QUAD_MAX_VERTICES) return null;

  let corners = vertices;
  if (n > 4) {
    corners = reduceToN(vertices, 4, diagonal);
    if (!corners || corners.length !== 4) return null;
  }

  const angles = polygonAngles(corners);
  const HALF_PI = Math.PI / 2;
  const angleErrors = angles.map(a => Math.abs(a - HALF_PI));
  if (angleErrors.some(e => e > T.QUAD_ANGLE_TOLERANCE)) return null;

  const edges = edgeLengths(corners);
  const avgW = (edges[0] + edges[2]) / 2;
  const avgH = (edges[1] + edges[3]) / 2;
  const sideAspectRatio = Math.min(avgW, avgH) / Math.max(avgW, avgH);

  const sideRatio02 = Math.min(edges[0], edges[2]) / Math.max(edges[0], edges[2]);
  const sideRatio13 = Math.min(edges[1], edges[3]) / Math.max(edges[1], edges[3]);
  if (sideRatio02 < T.QUAD_SIDE_RATIO_MIN || sideRatio13 < T.QUAD_SIDE_RATIO_MIN) return null;

  const avgAngleErr = angleErrors.reduce((s, e) => s + e, 0) / 4;
  const angleScore = 1 - avgAngleErr / HALF_PI;
  const sideScore = (sideRatio02 + sideRatio13) / 2;

  let rotation = 0;
  if (corners.length === 4) {
    const getEdgeAngle = (p1, p2) => Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const edgeAngles = [
      getEdgeAngle(corners[0], corners[1]),
      getEdgeAngle(corners[1], corners[2]),
      getEdgeAngle(corners[2], corners[3]),
      getEdgeAngle(corners[3], corners[0]),
    ];

    let baseDeg = (edgeAngles[0] * 180) / Math.PI;
    let sumRelativeDev = 0;
    edgeAngles.forEach((a, i) => {
      let deg = (a * 180) / Math.PI;
      let expected = baseDeg + i * 90;
      let diff = deg - expected;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      sumRelativeDev += diff;
    });

    let avgRotation = baseDeg + sumRelativeDev / 4;
    while (avgRotation > 180) avgRotation -= 360;
    while (avgRotation < -180) avgRotation += 360;

    const snapTarget = Math.round(avgRotation / 90) * 90;
    if (Math.abs(avgRotation - snapTarget) < 10) avgRotation = snapTarget;
    rotation = avgRotation;
  }

  const confidence = Math.max(0, Math.min(1,
    0.40 * angleScore +
    0.30 * sideAspectRatio +
    0.30 * sideScore
  ));

  if (confidence < T.QUAD_CONFIDENCE_THRESHOLD) return null;

  const kind = sideAspectRatio >= T.SQUARE_ASPECT_RATIO_MIN ? "square" : "rectangle";

  return {
    kind,
    confidence,
    debug: { ...sharedDebug, cornerCount: 4, angles, edges, aspectRatio: sideAspectRatio, sideRatio02, sideRatio13, rotation, corners }
  };
}
