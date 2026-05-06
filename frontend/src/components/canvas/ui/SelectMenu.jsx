import React from "react";
import { MousePointer2, MousePointerClick, Pointer, ChevronUp } from "lucide-react";

export default function SelectMenu({ 
    tool, 
    setTool, 
    selectsOpen, 
    setSelectsOpen, 
    selectsRef, 
    lastSelectType, 
    setLastSelectType, 
    isDark, 
    ghostBtnClass 
}) {
    const displayType = ["select", "select-blocks", "select-shapes"].includes(tool) ? tool : lastSelectType;

    return (
        <div className="relative pointer-events-auto" ref={selectsRef}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
        >
            <button
                className={`btn btn-sm ${["select", "select-blocks", "select-shapes"].includes(tool) ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass} border-none rounded-xl`}
                onClick={(e) => { 
                    e.stopPropagation(); 
                    const nextOpen = !selectsOpen;
                    setSelectsOpen(nextOpen); 
                    if (nextOpen) setTool(lastSelectType);
                }}
            >
                <div className="flex items-center gap-2">
                    {displayType === "select" && <MousePointer2 className="w-5 h-5" />}
                    {displayType === "select-blocks" && <Pointer className="w-5 h-5" />}
                    {displayType === "select-shapes" && <MousePointerClick className="w-5 h-5" />}
                    <ChevronUp className={`w-4 h-4 opacity-50 transition-transform ${selectsOpen ? "rotate-180" : ""}`} />
                </div>
            </button>

            {selectsOpen && (
                <div id="selects-popup" className="ui-container z-50 p-3 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-2xl flex gap-3 pointer-events-auto absolute bottom-full left-1/2 -translate-x-1/2 mb-3">
                    <button 
                        className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} 
                        onClick={() => { setTool("select"); setLastSelectType("select"); setSelectsOpen(false); }}
                        data-tip="All Layers (Select Everything)"
                    >
                        <MousePointer2 className="w-5 h-5" />
                    </button>
                    <button 
                        className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} 
                        onClick={() => { setTool("select-shapes"); setLastSelectType("select-shapes"); setSelectsOpen(false); }}
                        data-tip="Top Layer (Shapes & Strokes)"
                    >
                        <MousePointerClick className="w-5 h-5" />
                    </button>
                    <button 
                        className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} 
                        onClick={() => { setTool("select-blocks"); setLastSelectType("select-blocks"); setSelectsOpen(false); }}
                        data-tip="Bottom Layer (DOM Blocks)"
                    >
                        <Pointer className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
}
