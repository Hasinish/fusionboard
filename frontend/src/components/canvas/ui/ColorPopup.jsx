import React from "react";

export default function ColorPopup({ 
    color, 
    setColor, 
    setColorOpen, 
    isDark, 
    toolbarHeight, 
    colorRef,
    isToolbarVisible
}) {
    return (
        <div id="color-popup" data-ui="color-menu" className={`ui-container z-40 p-4 bg-white/15 backdrop-blur-lg border border-white/50 shadow-lg rounded-2xl w-56 pointer-events-auto transition-all duration-300 scale-90 origin-bottom ${isToolbarVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`} style={{ position: 'absolute', bottom: (toolbarHeight * 0.9) + 130, left: colorRef.current ? colorRef.current.getBoundingClientRect().left + colorRef.current.offsetWidth / 2 : '50%', transform: `translateX(-50%) translateY(${isToolbarVisible ? '0' : '2rem'})` }}>
            <div className="grid grid-cols-4 gap-3">
                {["#000000", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#ffffff"].map((c) => (
                    <button key={c} className={`w-10 h-10 rounded-full border transition-all hover:scale-110 active:scale-90 ${isDark ? "border-white/10" : "border-base-300"}`} style={{ backgroundColor: c }} onClick={() => { setColor(c); setColorOpen(false); }} />
                ))}
            </div>
            <div className={`h-px w-full my-4 bg-white/20`} />
            <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">Custom</span>
                <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className={`w-full h-9 cursor-pointer rounded-xl bg-white/10 p-1 border border-white/20`}
                />
            </div>
        </div>
    );
}
