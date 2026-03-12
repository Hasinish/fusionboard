import { rdpSimplify } from "../rdp.js";
import { dist } from "../pointUtils.js";

/**
 * Iteratively increase RDP epsilon to reduce vertices to exactly `target`.
 * Returns null if it can't converge.
 *
 * @param {{ x: number, y: number }[]} pts
 * @param {number} target
 * @param {number} diagonal
 * @returns {{ x: number, y: number }[]|null}
 */
export function reduceToN(pts, target, diagonal) {
  let eps = diagonal * 0.03;
  const maxEps = diagonal * 0.40;
  const step = diagonal * 0.01; 

  while (eps <= maxEps) {
    let reduced = rdpSimplify(pts, eps);
    // Close the polygon
    if (reduced.length > 2 && dist(reduced[0], reduced[reduced.length - 1]) < diagonal * 0.15) {
      reduced = reduced.slice(0, -1);
    }
    if (reduced.length === target) return reduced;
    if (reduced.length < target) return null; // over-simplified
    eps += step;
  }
  return null;
}
