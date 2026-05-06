import React from "react";
import { Plus, Terminal, Youtube, LineChart, Network } from "lucide-react";

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
                className={`btn btn-sm ${["code", "video", "graph", "mermaid"].includes(tool) ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass} border-none rounded-xl`}
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
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            id="insert-image-input"
                            onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                setPlusOpen(false);
                                // We dispatch a custom event that TestInfiniteCanvas will listen to
                                const event = new CustomEvent("fusionboard:upload-image", { detail: { file } });
                                window.dispatchEvent(event);
                                e.target.value = "";
                            }}
                        />
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => document.getElementById("insert-image-input").click()} data-tip="Image">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        </button>
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("code"); setPlusOpen(false); }} data-tip="Code (C)">
                            <Terminal className="w-5 h-5" />
                        </button>
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("mermaid"); setPlusOpen(false); }} data-tip="Flowchart (M)">
                            <Network className="w-5 h-5" />
                        </button>
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("graph"); setPlusOpen(false); }} data-tip="Math Graph (G)">
                            <LineChart className="w-5 h-5" />
                        </button>
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("video"); setPlusOpen(false); }} data-tip="Video (Y)">
                            <Youtube className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
