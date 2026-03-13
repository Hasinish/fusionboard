import React from "react";
import { Plus, Terminal, Youtube, LineChart } from "lucide-react";

export default function InsertMenu({ 
    tool, 
    setTool, 
    plusOpen, 
    setPlusOpen, 
    plusRef, 
    ghostBtnClass, 
    toolbarHeight 
}) {
    return (
        <div className="relative pointer-events-auto" ref={plusRef}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
        >
            <button
                className={`btn btn-sm ${["code", "video", "graph"].includes(tool) ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass} border-none rounded-xl`}
                onClick={(e) => { 
                    e.stopPropagation(); 
                    const nextOpen = !plusOpen;
                    setPlusOpen(nextOpen); 
                    if (nextOpen) setTool("select");
                }}
            >
                <Plus className="w-5 h-5" />
            </button>

            {plusOpen && (
                <div id="plus-popup" className="ui-container z-50 p-3 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-2xl pointer-events-auto absolute bottom-full left-1/2 -translate-x-1/2 mb-3" >
                    <div className="flex gap-2">
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("code"); setPlusOpen(false); }} data-tip="Code (C)">
                            <Terminal className="w-5 h-5" />
                        </button>
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("video"); setPlusOpen(false); }} data-tip="Video (Y)">
                            <Youtube className="w-5 h-5" />
                        </button>
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("graph"); setPlusOpen(false); }} data-tip="Graph (G)">
                            <LineChart className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
