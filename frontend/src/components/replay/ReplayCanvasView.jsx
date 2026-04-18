import React from "react";
import { MemoizedBoardElement } from "../canvas/BoardElement";
import { CanvasRenderer } from "../../canvas/CanvasRenderer";

export default function ReplayCanvasView({ 
  elements, 
  camera, 
  cursors = {},
  isDark, 
  bgMode = "dots" 
}) {
  const canvasRef = React.useRef(null);
  const rendererRef = React.useRef(null);

  React.useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
      rendererRef.current.start();
    }
    return () => {
      rendererRef.current?.stop();
      rendererRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setElements(elements || []);
      rendererRef.current.isDark = isDark;
      rendererRef.current.bgMode = bgMode;
    }
  }, [elements, isDark, bgMode]);

  React.useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setCamera(camera);
    }
  }, [camera]);

  const interactiveElements = React.useMemo(() => {
    return (elements || []).filter(el => 
      ['text', 'code', 'video', 'graph', 'sticky'].includes(el.type)
    );
  }, [elements]);

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

      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}
      />

      <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 15, pointerEvents: "none" }}>
        {interactiveElements.map((el) => (
          <MemoizedBoardElement
            key={el.id}
            el={el}
            camera={camera}
            tool="hand"
            isSelected={false}
            isMultiSelected={false}
            isViewer={true}
            isDarkMode={isDark}
            onSelect={() => {}}
            onGroupSelect={() => {}}
            onChange={() => {}}
            onDuplicate={() => {}}
            onDragGuide={() => {}}
            onStartEdit={() => {}}
            isEditing={false}
            onEndEdit={() => {}}
            onOpenSidebar={() => {}}
            onSidebarElementIdChange={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
