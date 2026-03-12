import { MousePointer2, Pen, Eraser, Type, Hand } from "lucide-react";

export default function CanvasToolbar({ 
    isViewer, 
    tool, 
    setTool, 
    ghostBtnClass, 
    isDark,
    toolbarRef,
    children
}) {
    return (
        <div
            ref={toolbarRef}
            className={`ui-container absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-lg px-4 py-2 z-30 flex items-center gap-3 max-w-[95vw] flex-wrap justify-center pointer-events-auto`}
        >
            {isViewer ? (
                /* Viewers only see the hand tool */
                <div className={`join ${isDark ? "bg-[#121212]/50" : "bg-base-200/50"} p-1 rounded-xl`}>
                    <button className={`btn btn-sm join-item border-none tooltip tooltip-top bg-primary text-primary-content shadow-lg`} onClick={() => setTool("hand")} data-tip="Hand (H)"><Hand className="w-5 h-5" /></button>
                </div>
            ) : (
                <>
                    <div className={`join ${isDark ? "bg-[#121212]/50" : "bg-base-200/50"} p-1 rounded-xl`}>
                        <button className={`btn btn-sm join-item border-none tooltip tooltip-top ${tool === "select" ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass}`} onClick={() => setTool("select")} data-tip="Select (V)"><MousePointer2 className="w-5 h-5" /></button>
                        <button className={`btn btn-sm join-item border-none tooltip tooltip-top ${tool === "pen" ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass}`} onClick={() => setTool("pen")} data-tip="Pen (P)"><Pen className="w-5 h-5" /></button>
                        <button className={`btn btn-sm join-item border-none tooltip tooltip-top ${tool === "eraser" ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass}`} onClick={() => setTool("eraser")} data-tip="Eraser (E)"><Eraser className="w-5 h-5" /></button>
                        <button className={`btn btn-sm join-item border-none tooltip tooltip-top ${tool === "text" ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass}`} onClick={() => setTool("text")} data-tip="Text (T)">
                            <Type className="w-5 h-5" />
                        </button>
                        <button className={`btn btn-sm join-item border-none tooltip tooltip-top ${tool === "hand" ? "bg-primary text-primary-content shadow-lg" : ghostBtnClass}`} onClick={() => setTool("hand")} data-tip="Hand (H)"><Hand className="w-5 h-5" /></button>
                    </div>
                    {children && (
                        <>
                            <div className={`w-px h-8 ${isDark ? "bg-white/20" : "bg-base-300"} rounded-full`} />
                            {children}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
