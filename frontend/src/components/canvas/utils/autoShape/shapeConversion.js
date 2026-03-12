/**
 * shapeConversion.js – Convert a pen path element to a native shape element
 */

import { DEFAULT_ELEMENT_STYLES } from "../../constants.js";
import { computeBounds, boundsCenter } from "./pointUtils.js";
import { convertToRect } from "./converters/RectConverter.js";
import { convertToCircle } from "./converters/CircleConverter.js";
import { convertToTriangle } from "./converters/TriangleConverter.js";

/**
 * Convert a finalized pen path into a native shape element.
 *
 * @param {Object} pathElement - the original path element
 * @param {Object} detection - classification result
 * @returns {Object|null} 
 */
export function convertPathToShape(pathElement, detection) {
  if (!pathElement || !detection || !detection.kind) return null;

  const points = pathElement.points || [];
  if (points.length === 0) return null;

  const bounds = computeBounds(points);
  const center = boundsCenter(bounds);

  let shapeProps;
  switch (detection.kind) {
    case "square":
    case "rectangle":
      shapeProps = convertToRect(pathElement, detection, center, bounds);
      break;
    case "circle":
      shapeProps = convertToCircle(pathElement, detection, center, bounds);
      break;
    case "triangle":
      shapeProps = convertToTriangle(pathElement, detection, bounds);
      break;
    default:
      return null;
  }

  const defaults = DEFAULT_ELEMENT_STYLES[shapeProps.type] || {};
  
  return {
    ...defaults,
    id: pathElement.id,
    ...shapeProps,
    stroke: pathElement.color || defaults.stroke || "#000000",
    strokeWidth: pathElement.width || defaults.strokeWidth || 2,
    fill: "transparent",
    text: "",
    userId: pathElement.userId
  };
}
