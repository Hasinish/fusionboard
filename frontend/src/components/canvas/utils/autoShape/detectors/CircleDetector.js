import { polygonAngles } from "../pointUtils.js";
import * as T from "../thresholds.js";

/**
 * @param {{ x: number, y: number }[]} vertices - simplified
 * @param {{ avgRadius: number, normalizedVariance: number }} rStats
 * @param {Object} sharedDebug
 * @returns {Object|null}
 */
export function detectCircle(vertices, rStats, sharedDebug) {
  if (vertices.length < T.CIRCLE_MIN_SIMPLIFIED_VERTICES) return null;
  if (sharedDebug.aspectRatio < T.CIRCLE_MIN_ASPECT_RATIO) return null;
  if (rStats.normalizedVariance > T.CIRCLE_MAX_RADIUS_VARIANCE) return null;

  const angles = polygonAngles(vertices);
  const sharpCount = angles.filter(a => a < T.CIRCLE_SHARP_ANGLE_RAD).length;
  const sharpRatio = sharpCount / vertices.length;
  if (sharpRatio > T.CIRCLE_MAX_SHARP_CORNER_RATIO) return null;

  const varianceScore = 1 - rStats.normalizedVariance / T.CIRCLE_MAX_RADIUS_VARIANCE;
  const aspectScore = sharedDebug.aspectRatio; 

  const confidence = Math.max(0, Math.min(1,
    0.55 * varianceScore +
    0.45 * aspectScore
  ));

  if (confidence < T.CIRCLE_CONFIDENCE_THRESHOLD) return null;

  return {
    kind: "circle",
    confidence,
    debug: {
      ...sharedDebug,
      cornerCount: vertices.length,
      angles: [],
      avgRadius: rStats.avgRadius,
      radiusVariance: rStats.normalizedVariance,
      sharpCornerRatio: sharpRatio,
    }
  };
}
