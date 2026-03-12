import React from "react";
import { getInitials } from "../utils/participantUtils";

export default function ParticipantsStrip({ 
    participants, 
    followedUserId, 
    setFollowedUserId, 
    talkingUserIds, 
    remoteCamerasRef, 
    setCamera, 
    isDark, 
    isMobile 
}) {
    if (isMobile) return null;

    return (
        <div className="ui-container flex -space-x-3 pointer-events-auto mr-2">
            {participants.slice(0, 5).map((p, idx) => (
                <div
                    key={`${p.userId}-${idx}`}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold shadow-sm transition-all duration-300 hover:scale-110 hover:z-10 cursor-pointer tooltip tooltip-bottom ${(followedUserId && String(followedUserId) === String(p.userId)) ? "ring-4 ring-blue-500 ring-offset-1 scale-110 z-10" : talkingUserIds.includes(p.userId) ? "ring-4 ring-green-400 animate-pulse scale-110 z-10" : ""}`}
                    style={{ backgroundColor: p.color || "#ccc", borderColor: p.color || "#ccc" }}
                    data-tip={p.name}
                    onClick={() => {
                        setFollowedUserId(prev => {
                            const uid = String(p.userId);
                            const next = (prev && String(prev) === uid) ? null : uid;
                            if (next && remoteCamerasRef.current[next]) {
                                setCamera(remoteCamerasRef.current[next]);
                            }
                            return next;
                        });
                    }}
                >
                    {p.avatar
                        ? <img src={p.avatar} alt={p.name} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                        : getInitials(p.name)
                    }
                </div>
            ))}
            {participants.length > 5 && (
                <div className={`w-10 h-10 rounded-full border-2 border-white ${isDark ? "bg-slate-800 text-slate-300" : "bg-base-300 text-base-content"} flex items-center justify-center text-xs font-bold shadow-sm`}>
                    +{participants.length - 5}
                </div>
            )}
        </div>
    );
}
