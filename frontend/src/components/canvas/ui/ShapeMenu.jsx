import React from "react";
import { StickyNote, Square, Circle, Triangle, ArrowRight, ChevronUp, Minus } from "lucide-react";

export default function ShapeMenu({ 
    tool, 
    setTool, 
    shapesOpen, 
    setShapesOpen, 
    shapesRef, 
    lastShapeType, 
    setLastShapeType, 
    isDark, 
    ghostBtnClass, 
    toolbarHeight 
}) {
    return (
        <div className="relative pointer-events-auto" ref={shapesRef}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
        >
            <button
                className={`btn btn-sm ${["sticky", "rect", "ellipse", "triangle", "arrow", "line"].includes(tool) ? "bg-warning text-warning-content" : ghostBtnClass} border-none rounded-xl`}
                onClick={(e) => { 
                    e.stopPropagation(); 
                    const nextOpen = !shapesOpen;
                    setShapesOpen(nextOpen); 
                    if (nextOpen) setTool("select");
                }}
            >
                <div className="flex items-center gap-2">
                    {lastShapeType === "sticky" && <StickyNote className="w-5 h-5 text-warning" />}
                    {lastShapeType === "rect" && <Square className="w-5 h-5" color={isDark ? "#ffffff" : "black"} fill="transparent" strokeWidth={2} />}
                    {lastShapeType === "ellipse" && <Circle className="w-5 h-5" color={isDark ? "#ffffff" : "black"} fill="transparent" strokeWidth={2} />}
                    {lastShapeType === "triangle" && <Triangle className="w-5 h-5" color={isDark ? "#ffffff" : "black"} fill="transparent" strokeWidth={2} />}
                    {lastShapeType === "arrow" && <ArrowRight className="w-5 h-5" color={isDark ? "#ffffff" : "black"} strokeWidth={2} />}
                    {lastShapeType === "line" && <Minus className="w-5 h-5" color={isDark ? "#ffffff" : "black"} strokeWidth={3} />}
                    <ChevronUp className={`w-4 h-4 opacity-50 transition-transform ${shapesOpen ? "rotate-180" : ""}`} />
                </div>
            </button>

            {shapesOpen && (
                <div id="shapes-popup" className="ui-container z-50 p-4 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-2xl w-72 min-w-[280px] pointer-events-auto absolute bottom-full left-1/2 -translate-x-1/2 mb-3">
                    <div className="grid grid-cols-5 gap-3">
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("sticky"); setLastShapeType("sticky"); setShapesOpen(false); }} data-tip="Sticky Note (S)"><StickyNote className="w-5 h-5 text-warning" /></button>
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("rect"); setLastShapeType("rect"); setShapesOpen(false); }} data-tip="Rectangle (R)"><Square className="w-5 h-5" color={isDark ? "white" : "black"} fill="transparent" strokeWidth={2} /></button>
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("ellipse"); setLastShapeType("ellipse"); setShapesOpen(false); }} data-tip="Ellipse (O)"><Circle className="w-5 h-5" color={isDark ? "white" : "black"} fill="transparent" strokeWidth={2} /></button>
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("triangle"); setLastShapeType("triangle"); setShapesOpen(false); }} data-tip="Triangle"><Triangle className="w-5 h-5" color={isDark ? "white" : "black"} fill="transparent" strokeWidth={2} /></button>
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("arrow"); setLastShapeType("arrow"); setShapesOpen(false); }} data-tip="Arrow (A)"><ArrowRight className="w-5 h-5" color={isDark ? "white" : "black"} strokeWidth={2} /></button>
                        <button className={`btn btn-sm ${ghostBtnClass} tooltip tooltip-top`} onClick={() => { setTool("line"); setLastShapeType("line"); setShapesOpen(false); }} data-tip="Line (L)"><Minus className="w-5 h-5" color={isDark ? "white" : "black"} strokeWidth={3} /></button>
                    </div>
                </div>
            )}
        </div>
    );
}
