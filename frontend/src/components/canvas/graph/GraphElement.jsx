import React, { useState, useEffect, useRef } from "react";
import GraphRenderer from "./GraphRenderer";
import { RotateCcw, Plus, Minus, Hand } from "lucide-react";
import { zoomViewportAt } from "./graphViewport";

export default function GraphElement({ 
  element, 
  onChange, 
  isDark, 
  isSelected,
  sw,
  sh,
  camera,
  isViewer = false,
  onOpenSidebar,
  sidebarElementId,
  onSidebarElementIdChange,
  isSidebarOpen
}) {
  const isEditing = element.id === sidebarElementId;
  const containerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [internalPanOverride, setInternalPanOverride] = useState(null);
  const zoom = camera.z || 1;
  const isInternalPanMode = !isViewer && (
    isEditing && isSidebarOpen
      ? (internalPanOverride ?? true)
      : false
  );

  const triggerEdit = () => {
    if (isViewer) return;
    setInternalPanOverride(null);
    onSidebarElementIdChange?.(element.id);
    onOpenSidebar?.(true);
  };

  // Exit editing mode when clicking outside the element
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setInternalPanOverride(null);
        onSidebarElementIdChange?.(null);
        onOpenSidebar?.(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, onOpenSidebar, onSidebarElementIdChange]);

  const handleUpdate = (updates, persist = true) => {
    onChange({ ...element, ...updates }, persist);
  };

  const handleViewportChange = (viewport) => {
    handleUpdate({ viewport }, true);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full rounded-lg ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <GraphRenderer 
        element={element}
        isDark={isDark}
        isEditing={(isEditing || isInternalPanMode) && !isViewer}
        isInternalPanMode={isInternalPanMode}
        onViewportChange={handleViewportChange}
        sw={sw}
        sh={sh}
        zoom={zoom}
      />

      {/* Floating View Controls - Scaled with camera.z for natural feel */}
      {zoom > 0.25 && !isViewer && isHovered && (
        <div 
          className="absolute flex gap-1 z-[20] pointer-events-auto animate-in fade-in duration-200"
          style={{ 
            top: 8 * zoom, 
            left: 8 * zoom,
            gap: 6 * zoom 
          }}
          onPointerDown={e => e.stopPropagation()}
        >
          <div className={`flex ${isDark ? "bg-[#2d2d2d]/90 border-white/10" : "bg-white/90 border-gray-200"} backdrop-blur rounded shadow-sm border overflow-hidden`} style={{ borderRadius: 6 * zoom }}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setInternalPanOverride((prev) => {
                  const currentValue = prev ?? true;
                  return !currentValue;
                });
              }}
              className={`transition-all active:scale-95 flex items-center justify-center border-r ${
                isInternalPanMode 
                  ? "bg-blue-500 text-white" 
                  : (isDark ? "text-gray-300 border-white/5 hover:bg-white/10" : "text-gray-600 border-gray-100 hover:bg-gray-50")
              }`}
              style={{ 
                width: 28 * zoom, 
                height: 28 * zoom
              }}
              title={isInternalPanMode ? "Disable Internal Pan" : "Enable Internal Pan"}
            >
              <Hand size={14 * zoom} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...element, viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 } }, true);
              }}
              className={`hover:bg-primary/10 ${isDark ? "text-gray-300 border-white/5" : "text-gray-600 border-gray-100"} transition-all active:scale-95 flex items-center justify-center border-r`}
              style={{ 
                width: 28 * zoom, 
                height: 28 * zoom
              }}
              title="Reset View"
            >
              <RotateCcw size={14 * zoom} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const factor = 1 / 1.5;
                const center = { x: sw / 2, y: sh / 2 };
                const newViewport = zoomViewportAt(element.viewport, center, factor, { w: sw, h: sh });
                handleViewportChange(newViewport);
              }}
              className={`hover:bg-primary/10 ${isDark ? "text-gray-300 border-white/5" : "text-gray-600 border-gray-100"} transition-all active:scale-95 flex items-center justify-center border-r`}
              style={{ 
                width: 28 * zoom, 
                height: 28 * zoom
              }}
              title="Zoom In"
            >
              <Plus size={14 * zoom} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const factor = 1.5;
                const center = { x: sw / 2, y: sh / 2 };
                const newViewport = zoomViewportAt(element.viewport, center, factor, { w: sw, h: sh });
                handleViewportChange(newViewport);
              }}
              className={`hover:bg-primary/10 ${isDark ? "text-gray-300" : "text-gray-600"} transition-all active:scale-95 flex items-center justify-center`}
              style={{ 
                width: 28 * zoom, 
                height: 28 * zoom
              }}
              title="Zoom Out"
            >
              <Minus size={14 * zoom} />
            </button>
          </div>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              triggerEdit();
            }}
            className={`${isDark ? "bg-[#2d2d2d]/90 border-white/10 text-gray-200" : "bg-white/90 border-gray-200 text-gray-700"} backdrop-blur hover:bg-primary/10 rounded shadow-sm border transition-all active:scale-95 font-bold flex items-center justify-center`}
            style={{ 
              height: 28 * zoom, 
              padding: `0 ${10 * zoom}px`,
              fontSize: 12 * zoom,
              borderRadius: 6 * zoom
            }}
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
