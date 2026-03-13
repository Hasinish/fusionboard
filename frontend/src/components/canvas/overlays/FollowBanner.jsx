import React from "react";
import { X } from "lucide-react";

/**
 * Follow mode banner
 */
export function FollowBanner({ followedUserId, participants, onStopFollow, isMobile }) {
    const [pos, setPos] = React.useState(null); // {x, y} relative to viewport
    const [isDragging, setIsDragging] = React.useState(false);
    const dragInfo = React.useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

    if (!followedUserId) return null;

    const handlePointerDown = (e) => {
        e.stopPropagation();
        if (e.button !== 0) return; // Only left click / primary touch

        const rect = e.currentTarget.getBoundingClientRect();
        dragInfo.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: rect.left,
            initialY: rect.top
        };
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!isDragging) return;
        e.stopPropagation();

        const dx = e.clientX - dragInfo.current.startX;
        const dy = e.clientY - dragInfo.current.startY;

        setPos({
            x: dragInfo.current.initialX + dx,
            y: dragInfo.current.initialY + dy
        });
    };

    const handlePointerUp = (e) => {
        if (!isDragging) return;
        e.stopPropagation();
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // Default positioning logic
    const defaultClasses = isMobile 
        ? "bottom-32 left-1/2 -translate-x-1/2" 
        : "bottom-24 left-1/2 -translate-x-1/2";
    
    const style = {
        position: 'absolute',
        zIndex: 40,
        willChange: 'transform',
        ...(pos ? {
            left: 0,
            top: 0,
            transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
            bottom: 'auto',
            right: 'auto'
        } : {})
    };

    return (
        <div 
            className={`ui-container ${!pos ? defaultClasses : ""} flex items-center gap-3 bg-blue-600/90 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-white/20 pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 ${isDragging ? "transition-none" : "transition-transform"}`}
            style={style}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-1" />
            <span className="text-sm font-bold tracking-tight select-none">
                Following {participants.find(p => p.userId === followedUserId)?.name || "User"}
            </span>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button 
                className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors" 
                onClick={(e) => {
                    e.stopPropagation();
                    onStopFollow();
                }}
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when clicking close
                title="Stop Following"
            >
                <X size={16} strokeWidth={3} />
            </button>
        </div>
    );
}

export default FollowBanner;
