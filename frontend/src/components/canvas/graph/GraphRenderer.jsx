import React, { useMemo } from "react";
import { compileExplicitExpression, sampleExpression } from "./graphMath";
import { worldToGraphScreen, panViewport, zoomViewportAt } from "./graphViewport";

export default function GraphRenderer({ 
  element, 
  isDark, 
  isEditing, 
  onViewportChange,
  sw,
  sh,
  zoom,
  isInternalPanMode
}) {
  const { viewport, expressions, points, ui, grid } = element;
  const blockDims = { w: sw, h: sh };

  // Memoize compiled expressions to avoid re-parsing on every render
  const compiledExprs = useMemo(() => {
    return expressions
      .filter(ex => ex.visible && ex.latex)
      .map(ex => ({
        ...ex,
        compiled: compileExplicitExpression(ex.latex)
      }));
  }, [expressions]);

  // Sample points for paths
  const sampledPaths = useMemo(() => {
    return compiledExprs.map(ex => ({
      color: ex.color,
      paths: sampleExpression(ex.compiled, viewport, sw)
    }));
  }, [compiledExprs, viewport, sw]);

  // Calculate axis positions in screen coordinates
  const origin = worldToGraphScreen({ x: 0, y: 0 }, viewport, blockDims);

  // Interaction handlers (only when isEditing is true)
  const handleWheel = (e) => {
    if (!isEditing) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const anchor = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    const zoomStep = 1.1;
    const factor = e.deltaY > 0 ? zoomStep : 1 / zoomStep;
    const newViewport = zoomViewportAt(viewport, anchor, factor, blockDims);
    onViewportChange(newViewport);
  };

  const handlePointerDown = (e) => {
    if (!isEditing) return;
    
    // Pan internals if:
    // 1. Hand tool is active (isInternalPanMode)
    // 2. Middle click (button 1)
    // 3. Alt key is held
    const shouldPanInternally = isInternalPanMode || e.button === 1 || e.altKey;
    if (!shouldPanInternally) return;

    e.stopPropagation();
    const startPoint = { x: e.clientX, y: e.clientY };
    const initialViewport = { ...viewport };

    const handlePointerMove = (moveEvent) => {
      const delta = {
        x: moveEvent.clientX - startPoint.x,
        y: moveEvent.clientY - startPoint.y
      };
      const panned = panViewport(initialViewport, delta, blockDims);
      onViewportChange(panned);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  // Rendering helpers for grid/axes
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const axisColor = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";

  return (
    <svg 
      width={sw} 
      height={sh} 
      className={`select-none touch-none ${isDark ? "bg-[#1f1f1f]" : "bg-white"} rounded-lg shadow-inner overflow-hidden border ${isDark ? "border-white/10" : "border-gray-100"}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      style={{ cursor: isInternalPanMode ? "grab" : "inherit" }}
    >
      {/* Grid Lines */}
      {ui.showGrid && grid.step > 0 && Array.from({ length: Math.ceil((viewport.xMax - viewport.xMin) / grid.step) + 1 }).map((_, i) => {
        const xWorld = Math.floor(viewport.xMin / grid.step) * grid.step + i * grid.step;
        const screen = worldToGraphScreen({ x: xWorld, y: 0 }, viewport, blockDims);
        return <line key={`gx-${i}`} x1={screen.x} y1={0} x2={screen.x} y2={sh} stroke={gridColor} />;
      })}
      {ui.showGrid && grid.step > 0 && Array.from({ length: Math.ceil((viewport.yMax - viewport.yMin) / grid.step) + 1 }).map((_, i) => {
        const yWorld = Math.floor(viewport.yMin / grid.step) * grid.step + i * grid.step;
        const screen = worldToGraphScreen({ x: 0, y: yWorld }, viewport, blockDims);
        return <line key={`gy-${i}`} x1={0} y1={screen.y} x2={sw} y2={screen.y} stroke={gridColor} />;
      })}

      {/* Axes */}
      {ui.showAxes && (
        <>
          <line x1={0} y1={origin.y} x2={sw} y2={origin.y} stroke={axisColor} strokeWidth={2 * zoom} />
          <line x1={origin.x} y1={0} x2={origin.x} y2={sh} stroke={axisColor} strokeWidth={2 * zoom} />
        </>
      )}

      {/* Expressions */}
      {sampledPaths.map((exprPaths, i) => (
        <g key={`expr-${i}`}>
          {exprPaths.paths.map((pts, j) => {
            const d = pts.map((p, k) => {
              const s = worldToGraphScreen(p, viewport, blockDims);
              return `${k === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
            }).join(' ');
            return <path key={`p-${j}`} d={d} fill="none" stroke={exprPaths.color} strokeWidth={2 * zoom} strokeLinecap="round" strokeLinejoin="round" />;
          })}
        </g>
      ))}

      {/* Points */}
      {points.filter(p => p.visible).map((p, i) => {
        const s = worldToGraphScreen(p, viewport, blockDims);
        return (
          <g key={`point-${i}`}>
            <circle cx={s.x} cy={s.y} r={4 * zoom} fill={p.color} />
            {ui.showLabels && p.label && (
              <text x={s.x + (6 * zoom)} y={s.y - (6 * zoom)} fontSize={10 * zoom} fill={p.color} fontWeight="bold">
                {p.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
