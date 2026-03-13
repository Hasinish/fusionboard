export const DEFAULT_VIEWPORT = {
  xMin: -10,
  xMax: 10,
  yMin: -10,
  yMax: 10
};

export const DEFAULT_GRID = {
  show: true,
  step: 1
};

export const DEFAULT_EXPRESSIONS = [
  {
    id: "expr_1",
    latex: "y=x^2",
    color: "#2563eb",
    visible: true
  }
];

export const GRAPH_COLORS = [
  "#2563eb", // Blue
  "#ef4444", // Red
  "#10b981", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#ec4899", // Pink
];

export const MIN_GRAPH_SIZE = {
  w: 200,
  h: 200
};

export function createDefaultGraphElement({ x, y, id }) {
  return {
    id,
    type: "graph",
    x,
    y,
    w: 400,
    h: 300,
    rotation: 0,
    fill: "#ffffff",
    stroke: "#d1d5db",
    strokeWidth: 1,
    viewport: { ...DEFAULT_VIEWPORT },
    grid: { ...DEFAULT_GRID },
    expressions: [...DEFAULT_EXPRESSIONS],
    points: [],
    ui: {
      showGrid: true,
      showAxes: true,
      showLabels: true
    }
  };
}
