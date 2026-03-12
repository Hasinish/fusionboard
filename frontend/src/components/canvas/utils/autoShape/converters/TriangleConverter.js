import { centroid } from "../pointUtils.js";

export function convertToTriangle(pathElement, detection, bounds) {
  const corners = detection.debug?.corners;
  if (!corners || corners.length !== 3) {
    return { type: "triangle", x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h, rotation: 0 };
  }

  const ctr = centroid(corners);
  
  let apexIdx = 0, maxApexDist = 0;
  for (let i = 0; i < 3; i++) {
    const o1 = corners[(i + 1) % 3], o2 = corners[(i + 2) % 3];
    const mid = { x: (o1.x + o2.x) / 2, y: (o1.y + o2.y) / 2 };
    const d = Math.hypot(corners[i].x - mid.x, corners[i].y - mid.y);
    if (d > maxApexDist) { maxApexDist = d; apexIdx = i; }
  }
  
  const apex = corners[apexIdx], b1 = corners[(apexIdx + 1) % 3], b2 = corners[(apexIdx + 2) % 3];
  const baseLen = Math.hypot(b2.x - b1.x, b2.y - b1.y);
  const w = Math.max(20, baseLen);
  const h = Math.max(20, Math.abs((b2.x - b1.x) * (b1.y - apex.y) - (b1.x - apex.x) * (b2.y - b1.y)) / baseLen);
  
  const angleToApex = Math.atan2(apex.y - ctr.y, apex.x - ctr.x);
  let rotDeg = (angleToApex - (-Math.PI / 2)) * (180 / Math.PI);
  while (rotDeg > 180) rotDeg -= 360; while (rotDeg < -180) rotDeg += 360;
  const snapped = Math.round(rotDeg / 90) * 90;
  if (Math.abs(rotDeg - snapped) < 15) rotDeg = snapped;
  
  const rad = (rotDeg * Math.PI) / 180;
  const offsetWorldX = - (h / 6) * Math.sin(rad);
  const offsetWorldY = (h / 6) * Math.cos(rad);
  
  return {
    type: "triangle",
    x: (ctr.x - offsetWorldX) - w / 2,
    y: (ctr.y - offsetWorldY) - h / 2,
    w, h,
    rotation: rotDeg
  };
}
