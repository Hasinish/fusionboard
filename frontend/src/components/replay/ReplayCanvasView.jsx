import React from "react";
import ElementsLayer from "../ElementsLayer";

export default function ReplayCanvasView({ 
  elements, 
  camera, 
  cursors = {},
  isDark, 
  bgMode = "dots" 
}) {
  const worldToScreen = React.useCallback((wx, wy) => ({
    x: wx * camera.z + camera.x,
    y: wy * camera.z + camera.y,
  }), [camera]);

  return (
    <div 
      className="relative w-full h-full overflow-hidden select-none touch-none"
      style={{ backgroundColor: isDark ? "#121212" : "#F0F0F0" }}
    >
      {/* Background Layer */}
      {bgMode === "dots" && (() => {
        const z = camera.z; const logZ = Math.log10(z); const floorLogZ = Math.floor(logZ);
        const scales = [Math.pow(10, -floorLogZ + 1), Math.pow(10, -floorLogZ), Math.pow(10, -floorLogZ - 1)];
        return (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {scales.map((s) => {
              const step = s * 100; const size = step * z;
              let op = 0;
              if (size > 10 && size < 1000) {
                if (size < 50) op = (size - 10) / 40;
                else if (size > 400) op = 1 - (size - 400) / 600;
                else op = 1;
              }
              if (op <= 0) return null;
              const gridColor = isDark ? "255,255,255" : "0,0,0";
              return (
                <div key={s} className="absolute inset-0"
                  style={{
                    backgroundImage: `radial-gradient(circle at 1.5px 1.5px, rgba(${gridColor}, ${op * (isDark ? 0.4 : 0.3)}) 1.5px, transparent 1.5px)`,
                    backgroundSize: `${step * z}px ${step * z}px`,
                    backgroundPosition: `${camera.x - 1.5}px ${camera.y - 1.5}px`
                  }}
                />
              );
            })}
          </div>
        );
      })()}

      <ElementsLayer
        elements={elements}
        camera={camera}
        isDark={isDark}
        isViewer={true}
        // Dummy props required by ElementsLayer
        tool="hand"
        selectedIds={[]}
        setSelectedIds={() => {}}
        onElementsChange={() => {}}
      />
    </div>
  );
}
