import React from "react";

/**
 * Follow mode banner
 */
export function FollowBanner({ followedUserId, participants, onStopFollow, isMobile }) {
    if (!followedUserId) return null;

    return (
        <div className={`ui-container absolute ${isMobile ? "top-[150px] left-5 translate-x-0" : "top-4 left-1/2 -translate-x-1/2"} z-50 flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg pointer-events-auto transition-all`}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
        >
            <span className="text-sm font-semibold">
                Following {participants.find(p => p.userId === followedUserId)?.name || "User"}
            </span>
            <button 
                className="btn btn-xs btn-circle btn-ghost hover:bg-white/20 text-white border-none ml-1" 
                onClick={onStopFollow}
            >
                ✕
            </button>
        </div>
    );
}

export default FollowBanner;
