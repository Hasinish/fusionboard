/**
 * autoShape.debug.js – Deterministic test fixture for auto-shape detection
 *
 * Usage (in browser DevTools console after `npm run dev`):
 *   import('/src/components/canvas/utils/autoShape/autoShape.debug.js').then(m => m.runAll())
 *
 * NOT imported anywhere in production code.
 */

import { classifyStroke } from "./classifyStroke.js";

/** Generate points along a circle */
function circlePoints(cx, cy, r, n = 40, noise = 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({
      x: cx + Math.cos(a) * r + (Math.random() - 0.5) * noise,
      y: cy + Math.sin(a) * r + (Math.random() - 0.5) * noise,
    });
  }
  return pts;
}

/** Generate points along a square */
function squarePoints(x, y, size, pointsPerSide = 10, noise = 0) {
  const pts = [];
  const add = (x1, y1, x2, y2) => {
    for (let i = 0; i <= pointsPerSide; i++) {
      const t = i / pointsPerSide;
      pts.push({
        x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * noise,
        y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * noise,
      });
    }
  };
  add(x, y, x + size, y);
  add(x + size, y, x + size, y + size);
  add(x + size, y + size, x, y + size);
  add(x, y + size, x, y);
  return pts;
}

/** Generate points along a triangle */
function trianglePoints(cx, cy, size, noise = 0) {
  const pts = [];
  const vertices = [
    { x: cx, y: cy - size * 0.6 },
    { x: cx + size * 0.5, y: cy + size * 0.4 },
    { x: cx - size * 0.5, y: cy + size * 0.4 },
  ];
  const pointsPerSide = 12;
  for (let s = 0; s < 3; s++) {
    const a = vertices[s];
    const b = vertices[(s + 1) % 3];
    for (let i = 0; i <= pointsPerSide; i++) {
      const t = i / pointsPerSide;
      pts.push({
        x: a.x + (b.x - a.x) * t + (Math.random() - 0.5) * noise,
        y: a.y + (b.y - a.y) * t + (Math.random() - 0.5) * noise,
      });
    }
  }
  return pts;
}

/** Random scribble */
function scribblePoints(n = 50) {
  const pts = [];
  let x = 200, y = 200;
  for (let i = 0; i < n; i++) {
    x += (Math.random() - 0.5) * 30;
    y += (Math.random() - 0.5) * 30;
    pts.push({ x, y });
  }
  return pts;
}

/** Straight open line */
function openLine() {
  const pts = [];
  for (let i = 0; i < 30; i++) {
    pts.push({ x: 100 + i * 10, y: 200 + (Math.random() - 0.5) * 4 });
  }
  return pts;
}

/** Tiny accidental tap */
function tinyStroke() {
  return [
    { x: 100, y: 100 }, { x: 101, y: 101 }, { x: 102, y: 100 },
    { x: 101, y: 99 }, { x: 100, y: 100 },
  ];
}

export function runAll() {
  const cases = [
    { name: "Clean circle",     pts: circlePoints(300, 300, 80, 50, 0),   expect: "circle" },
    { name: "Noisy circle",     pts: circlePoints(300, 300, 80, 50, 8),   expect: "circle" },
    { name: "Clean square",     pts: squarePoints(100, 100, 120, 12, 0),  expect: "square" },
    { name: "Noisy square",     pts: squarePoints(100, 100, 120, 12, 6),  expect: "square" },
    { name: "Clean triangle",   pts: trianglePoints(300, 300, 140, 0),    expect: "triangle" },
    { name: "Noisy triangle",   pts: trianglePoints(300, 300, 140, 6),    expect: "triangle" },
    { name: "Scribble",         pts: scribblePoints(),                    expect: null },
    { name: "Open line",        pts: openLine(),                          expect: null },
    { name: "Tiny stroke",      pts: tinyStroke(),                        expect: null },
  ];

  console.group("🔷 Auto-Shape Debug Fixture");
  for (const c of cases) {
    const result = classifyStroke(c.pts);
    const pass = result.kind === c.expect;
    const icon = pass ? "✅" : "❌";
    console.log(
      `${icon} ${c.name}: expected=${c.expect}, got=${result.kind} (confidence=${result.confidence.toFixed(3)})`,
      result.debug
    );
  }
  console.groupEnd();
}
