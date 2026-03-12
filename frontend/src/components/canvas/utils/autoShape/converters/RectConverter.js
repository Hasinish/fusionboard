import { centroid } from "../pointUtils.js";

export function convertToRect(pathElement, detection, center, bounds) {
  const corners = detection.debug?.corners;
  const edges = detection.debug?.edges;
  const ctr = corners ? centroid(corners) : center;
  const isSquare = detection.kind === "square";
  
  let w, h;
  if (edges && edges.length === 4) {
    const avgW = (edges[0] + edges[2]) / 2;
    const avgH = (edges[1] + edges[3]) / 2;
    w = isSquare ? (avgW + avgH) / 2 : avgW;
    h = isSquare ? w : avgH;
  } else {
    w = bounds.w;
    h = bounds.h;
  }

  return {
    type: "rect",
    x: ctr.x - w / 2,
    y: ctr.y - h / 2,
    w, h,
    rotation: detection.debug?.rotation || 0
  };
}
