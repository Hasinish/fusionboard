/**
 * thresholds.js – All numeric thresholds for auto-shape detection
 *
 * Every "magic number" lives here so it's easy to tune, debug, and document.
 * Changing a value here affects ALL detectors consistently.
 */

// ─── General pre-checks ────────────────────────────────────────────────────

/**
 * Minimum raw points in a stroke to even consider classification.
 * Very short scribbles (< 10 samples) are too ambiguous.
 */
export const MIN_POINTS = 10;

/**
 * Minimum bounding-box diagonal (world px) to consider a stroke.
 * Prevents accidental taps / tiny dots from triggering detection.
 */
export const MIN_DIAGONAL = 30;

/**
 * RDP epsilon for the first simplification pass.
 * Smaller = more detail preserved; larger = more aggressive reduction.
 * 3 px works well for typical pen strokes at 1× zoom.
 */
export const RDP_EPSILON = 3;

/**
 * Maximum ratio of (closure gap / bounds diagonal) for the stroke
 * to be considered "closed". If the first-to-last point distance
 * exceeds this fraction of the diagonal, the shape is "open".
 *
 * 0.25 means the gap must be ≤ 25% of the diagonal.
 */
export const CLOSURE_MAX_GAP_RATIO = 0.25;

/**
 * Alternative closure check: max ratio of (gap / total path length).
 * This handles oblong shapes where diagonal is large.
 */
export const CLOSURE_MAX_GAP_PATH_RATIO = 0.15;

// ─── Triangle detection ────────────────────────────────────────────────────

/**
 * After RDP we look for approximately this many corners.
 * For a triangle the simplified polygon should have 3–5 vertices
 * (endpoints may coincide, extra corner from closure).
 */
export const TRIANGLE_MIN_VERTICES = 3;
export const TRIANGLE_MAX_VERTICES = 14;

/**
 * Minimum area of the detected triangle as a fraction of bounding-box area.
 * Prevents degenerate/collinear "triangles".
 */
export const TRIANGLE_MIN_AREA_RATIO = 0.15;

/**
 * Each triangle interior angle must be at least this many radians
 * to avoid near-degenerate slivers. ~15°
 */
export const TRIANGLE_MIN_ANGLE = 0.26;

/**
 * Confidence threshold – classification is only returned if ≥ this value.
 */
export const TRIANGLE_CONFIDENCE_THRESHOLD = 0.55;

// ─── Square / rectangle detection ──────────────────────────────────────────

/**
 * After RDP the simplified polygon should have 4–6 vertices.
 */
export const QUAD_MIN_VERTICES = 4;
export const QUAD_MAX_VERTICES = 18;

/**
 * Each corner angle must be within this tolerance of 90° (π/2).
 */
export const QUAD_ANGLE_TOLERANCE = 0.55; // ~31 degrees

/**
 * Minimum aspect ratio (short/long side) for quads.
 * Set low (0.15) to allow long rectangles.
 */
export const QUAD_MIN_ASPECT_RATIO = 0.15;

/**
 * Threshold for identifying a "square" vs a "rectangle".
 */
export const SQUARE_ASPECT_RATIO_MIN = 0.85;

/**
 * Minimum similarity of opposite side lengths.
 */
export const QUAD_SIDE_RATIO_MIN = 0.50;

/**
 * Confidence threshold for square detection.
 */
export const QUAD_CONFIDENCE_THRESHOLD = 0.55;

// ─── Circle detection ──────────────────────────────────────────────────────

/**
 * Maximum normalized radius variance (variance / avgRadius²).
 * A perfect circle has 0. Hand-drawn circles typically ≤ 0.04.
 * Be generous: 0.06.
 */
export const CIRCLE_MAX_RADIUS_VARIANCE = 0.040;

/**
 * Aspect ratio of bounding box must be ≥ this for circle (near 1:1).
 * We set this to 0.70 to avoid catching clearly oblong rectangles.
 */
export const CIRCLE_MIN_ASPECT_RATIO = 0.70;

/**
 * If the simplified polygon has too few points (< this), the shape
 * is likely a polygon, not a circle. Circles simplify to many vertices.
 */
export const CIRCLE_MIN_SIMPLIFIED_VERTICES = 6;

/**
 * Confidence threshold for circle detection.
 */
export const CIRCLE_CONFIDENCE_THRESHOLD = 0.55;

/**
 * Maximum fraction of simplified vertices that can have "sharp" angles
 * (below CIRCLE_SHARP_ANGLE_RAD) for the shape to still be considered a circle.
 * We lower this to 0.15 to be more aggressive in rejecting polygons.
 */
export const CIRCLE_MAX_SHARP_CORNER_RATIO = 0.15;

/**
 * An interior angle below this (in radians) is considered a "sharp corner".
 * For a polygon with N sides, a regular polygon has interior angles of π(N-2)/N.
 * A square has π/2 ≈ 1.57. We use ~2.3 rad (~132°) to catch anything sharper
 * than what you'd expect on a smooth curve.
 */
export const CIRCLE_SHARP_ANGLE_RAD = 2.3;
