import React from "react";
import { ChevronRight, ChevronLeft, Settings2 } from "lucide-react";
import GraphEditorPanel from "../graph/GraphEditorPanel";

export default function PropertySidebar({ 
  isOpen, 
  setIsOpen, 
  element, 
  onChange, 
  isDark, 
  zoom 
}) {
  const isGraphSelected = element?.type === "graph";

  return (
    <>
      {/* Sidebar Handle - only show if a graph is selected */}
      {(isGraphSelected || (isOpen && element)) && (
        <div 
          className={`fixed top-1/2 -translate-y-1/2 right-0 z-[1001] transition-all duration-300 pointer-events-none ${isOpen ? "translate-x-[-360px]" : "translate-x-0"}`}
        >
          <button
            onClick={() => setIsOpen(!isOpen)}
            onPointerDown={e => e.stopPropagation()}
            className={`pointer-events-auto flex items-center justify-center w-8 h-12 rounded-l-lg border-l border-t border-b transition-all active:scale-95 ${
              isDark 
                ? "bg-[#111111] border-white/10 text-gray-500 hover:text-white" 
                : "bg-white border-gray-200 text-gray-400 hover:text-gray-600"
            } shadow-md`}
          >
            {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      )}

      {/* Main Sidebar Panel */}
      <div 
        className={`fixed top-0 right-0 h-full flex flex-col z-[1000] border-l transition-all duration-300 transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } ${
          isDark 
            ? "bg-[#111111] text-white border-white/5" 
            : "bg-white text-gray-800 border-gray-100"
        } shadow-xl`}
        style={{ width: 360 }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {element && element.type === "graph" ? (
          <GraphEditorPanel 
            element={element}
            onChange={onChange}
            zoom={zoom}
            isDark={isDark}
            onClose={() => setIsOpen(false)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 opacity-30 text-center">
            <Settings2 size={40} className="mb-4" />
            <p className="font-bold text-[11px] tracking-tight">Select an element to configure</p>
          </div>
        )}
      </div>
    </>
  );
}
