/**
 * Conversion from graph world coordinates to block screen coordinates (SVG pixels).
 */
export function worldToGraphScreen(worldPoint, viewport, blockDims) {
  const { x, y } = worldPoint;
  const { xMin, xMax, yMin, yMax } = viewport;
  const { w, h } = blockDims;

  const worldWidth = xMax - xMin;
  const worldHeight = yMax - yMin;

  const screenX = ((x - xMin) / worldWidth) * w;
  // SVG y is 0 at top, while math y is 0 at bottom/middle (depending on range)
  const screenY = h - ((y - yMin) / worldHeight) * h;

  return { x: screenX, y: screenY };
}

/**
 * Conversion from block screen coordinates (SVG pixels) to graph world coordinates.
 */
export function graphScreenToWorld(screenPoint, viewport, blockDims) {
  const { x, y } = screenPoint;
  const { xMin, xMax, yMin, yMax } = viewport;
  const { w, h } = blockDims;

  const worldWidth = xMax - xMin;
  const worldHeight = yMax - yMin;

  const worldX = xMin + (x / w) * worldWidth;
  const worldY = yMin + ((h - y) / h) * worldHeight;

  return { x: worldX, y: worldY };
}

/**
 * Pans the viewport by the given delta in screen pixels.
 */
export function panViewport(viewport, deltaPx, blockDims) {
  const { x: dx, y: dy } = deltaPx;
  const { xMin, xMax, yMin, yMax } = viewport;
  const { w, h } = blockDims;

  const worldWidth = xMax - xMin;
  const worldHeight = yMax - yMin;

  const worldDx = (dx / w) * worldWidth;
  const worldDy = (dy / h) * worldHeight;

  return {
    xMin: xMin - worldDx,
    xMax: xMax - worldDx,
    yMin: yMin + worldDy, // SVG y is inverted
    yMax: yMax + worldDy
  };
}

/**
 * Zooms the viewport at a specific screen point by a given factor.
 */
export function zoomViewportAt(viewport, screenAnchor, factor, blockDims) {
  const worldAnchor = graphScreenToWorld(screenAnchor, viewport, blockDims);
  const { xMin, xMax, yMin, yMax } = viewport;

  return {
    xMin: worldAnchor.x - (worldAnchor.x - xMin) * factor,
    xMax: worldAnchor.x + (xMax - worldAnchor.x) * factor,
    yMin: worldAnchor.y - (worldAnchor.y - yMin) * factor,
    yMax: worldAnchor.y + (yMax - worldAnchor.y) * factor
  };
}

/**
 * Helper to ensure viewport bounds are reasonable.
 */
export function normalizeViewport(viewport) {
  let { xMin, xMax, yMin, yMax } = viewport;
  
  if (xMin >= xMax) {
    xMin = -10;
    xMax = 10;
  }
  if (yMin >= yMax) {
    yMin = -10;
    yMax = 10;
  }

  return { xMin, xMax, yMin, yMax };
}

/**
 * Fits the viewport to a set of world points or resets to default.
 */
export function fitViewportToGraphContent(expressions, points, defaultViewport) {
  // Simplification for MVP: just use default or provide a reset button
  return { ...defaultViewport };
}
