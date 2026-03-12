import { polygonAngles, polygonArea, edgeLengths } from "../pointUtils.js";
import { reduceToN } from "./detectorUtils.js";
import * as T from "../thresholds.js";

/**
 * @param {{ x: number, y: number }[]} vertices - RDP simplified & closed
 * @param {number} diagonal
 * @param {Object} sharedDebug
 * @returns {Object|null}
 */
export function detectTriangle(vertices, diagonal, sharedDebug) {
  const n = vertices.length;
  if (n < T.TRIANGLE_MIN_VERTICES || n > T.TRIANGLE_MAX_VERTICES) return null;

  let corners = vertices;
  if (n > 3) {
    corners = reduceToN(vertices, 3, diagonal);
    if (!corners || corners.length !== 3) return null;
  }

  const angles = polygonAngles(corners);
  const area = polygonArea(corners);
  const boundsArea = sharedDebug.bounds.w * sharedDebug.bounds.h;

  if (boundsArea === 0 || area / boundsArea < T.TRIANGLE_MIN_AREA_RATIO) return null;
  if (angles.some(a => a < T.TRIANGLE_MIN_ANGLE)) return null;

  const edges = edgeLengths(corners);
  const minEdge = Math.min(...edges);
  if (minEdge < diagonal * 0.15) return null;

  const angleSum = angles.reduce((s, a) => s + a, 0);
  const angleSumError = Math.abs(angleSum - Math.PI) / Math.PI;
  const areaScore = Math.min(1, area / (boundsArea * 0.5));
  const edgeBalance = minEdge / Math.max(...edges);

  const confidence = Math.max(0, Math.min(1,
    0.4 * (1 - angleSumError) +
    0.3 * areaScore +
    0.3 * edgeBalance
  ));

  if (confidence < T.TRIANGLE_CONFIDENCE_THRESHOLD) return null;

  return {
    kind: "triangle",
    confidence,
    debug: { ...sharedDebug, cornerCount: 3, angles, triangleArea: area, edges, corners }
  };
}
