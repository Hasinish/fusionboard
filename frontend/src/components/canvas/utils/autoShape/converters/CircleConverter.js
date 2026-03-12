export function convertToCircle(pathElement, detection, center, bounds) {
  const diameter = (bounds.w + bounds.h) / 2;
  return {
    type: "ellipse",
    x: center.x - diameter / 2,
    y: center.y - diameter / 2,
    w: diameter,
    h: diameter,
    rotation: 0
  };
}
