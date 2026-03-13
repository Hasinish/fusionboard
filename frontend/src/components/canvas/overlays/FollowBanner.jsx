import React from "react";
import { X } from "lucide-react";

/**
 * Follow mode banner
 */
export function FollowBanner({ followedUserId, participants, onStopFollow, isMobile }) {
    const [pos, setPos] = React.useState(null); // {x, y} relative to viewport
    const bannerRef = React.useRef(null);
    const dragInfo = React.useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

    if (!followedUserId) return null;

    const handlePointerDown = (e) => {
        e.stopPropagation();
        if (e.button !== 0) return;

        const rect = e.currentTarget.getBoundingClientRect();
        dragInfo.current = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            initialX: rect.left,
            initialY: rect.top
        };
        
        // Ensure we are in "controlled" mode immediately
        if (!pos) {
            setPos({ x: rect.left, y: rect.top });
        }
        
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!dragInfo.current.isDragging || !bannerRef.current) return;
        e.stopPropagation();

        const dx = e.clientX - dragInfo.current.startX;
        const dy = e.clientY - dragInfo.current.startY;

        const newX = dragInfo.current.initialX + dx;
        const newY = dragInfo.current.initialY + dy;

        // HIGH PERFORMANCE: Update DOM directly to bypass React render cycle
        bannerRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
    };

    const handlePointerUp = (e) => {
        if (!dragInfo.current.isDragging) return;
        e.stopPropagation();
        
        // Sync the final position back to React state
        const rect = bannerRef.current.getBoundingClientRect();
        setPos({ x: rect.left, y: rect.top });
        
        dragInfo.current.isDragging = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // Default positioning logic (Tailwind classes)
    const defaultClasses = isMobile 
        ? "bottom-32 left-1/2 -translate-x-1/2" 
        : "bottom-24 left-1/2 -translate-x-1/2";
    
    const style = {
        position: 'fixed', // Use fixed for easier viewport-relative dragging
        zIndex: 100,
        willChange: 'transform',
        transition: 'none', // Kill all transitions during/after drag for total control
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
            ref={bannerRef}
            className={`ui-container ${!pos ? "absolute " + defaultClasses : ""} flex items-center gap-3 bg-blue-600/90 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-white/20 pointer-events-auto cursor-grab active:cursor-grabbing hover:scale-105 active:scale-95 transition-transform`}
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
                onPointerDown={(e) => e.stopPropagation()} 
                title="Stop Following"
            >
                <X size={16} strokeWidth={3} />
            </button>
        </div>
    );
}

export default FollowBanner;
