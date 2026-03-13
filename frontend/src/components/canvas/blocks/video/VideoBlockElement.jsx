import React, { useState } from "react";
import { Youtube, Link as LinkIcon, Edit2 } from "lucide-react";
import { getYouTubeId, getYouTubeEmbedUrl } from "./youtubeUtils";

export function VideoBlockElement({ 
    el, 
    camera, 
    onChange, 
    isSelected,
    handlePointerDown 
}) {
    const [inputValue, setInputValue] = useState(el.url || "");

    const handleUrlSubmit = (val) => {
        const id = getYouTubeId(val);
        onChange({ ...el, url: val, videoId: id });
    };

    return (
        <div 
            className="absolute inset-0 rounded-lg overflow-hidden flex flex-col shadow-xl bg-black"
            style={{ 
                border: `${el.strokeWidth || 1}px solid ${el.stroke}`,
            }}
            onPointerDown={handlePointerDown}
            onDoubleClick={(e) => e.stopPropagation()} // Prevent generic edit mode
        >
            {/* Header */}
            <div 
                className="flex items-center justify-between border-b border-[#313244] bg-[#181825]"
                style={{ padding: `${8 * camera.z}px ${12 * camera.z}px` }}
            >
                <div className="flex items-center" style={{ gap: `${8 * camera.z}px` }}>
                    <div className="flex" style={{ gap: `${6 * camera.z}px` }}>
                        <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#f87171' }} />
                        <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#facc15' }} />
                        <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#4ade80' }} />
                    </div>
                    <div className="flex items-center text-[#cdd6f4]" style={{ gap: 6 * camera.z, fontSize: 12 * camera.z }}>
                        <Youtube size={14 * camera.z} className="text-red-500" />
                        <span>YouTube</span>
                    </div>
                </div>

                {el.videoId && (
                    <button
                        className="text-[#a6adc8] hover:text-white transition-colors bg-transparent border-none cursor-pointer flex items-center"
                        title="Change Video"
                        onPointerDown={(e) => e.stopPropagation()} // Allow clicking button
                        onClick={() => onChange({ ...el, videoId: "", url: "" })}
                    >
                        <Edit2 size={12 * camera.z} />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 relative bg-[#11111b] flex items-center justify-center overflow-hidden">
                {el.videoId ? (
                    <>
                        <iframe
                            width="100%"
                            height="100%"
                            src={getYouTubeEmbedUrl(el.videoId)}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="YouTube Video"
                            style={{ 
                                pointerEvents: isSelected ? 'auto' : 'none',
                                display: 'block' 
                            }}
                        />
                        {/* Overlay for dragging when not selected */}
                        {!isSelected && (
                            <div className="absolute inset-0 bg-transparent" />
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-4 w-full px-6 text-center">
                        <Youtube size={48 * camera.z} className="text-[#313244]" />
                        <div className="w-full relative">
                            <input
                                type="text"
                                placeholder="Paste YouTube Link..."
                                className="w-full bg-[#1e1e2e] text-[#cdd6f4] border border-[#313244] rounded outline-none text-center transition-all focus:border-red-500/50"
                                style={{
                                    padding: `${8 * camera.z}px`,
                                    fontSize: 14 * camera.z
                                }}
                                value={inputValue}
                                onChange={(e) => {
                                    setInputValue(e.target.value);
                                    handleUrlSubmit(e.target.value);
                                }}
                                onPointerDown={(e) => e.stopPropagation()} // Allow interaction
                                onKeyDown={(e) => e.stopPropagation()}
                            />
                        </div>
                        <p style={{ fontSize: 11 * camera.z, color: '#6c7086' }}>
                            Supports youtube.com and youtu.be links
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
