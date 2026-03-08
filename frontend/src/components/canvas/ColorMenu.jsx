import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { COLORS } from "./constants";

export function ColorMenu({ value, onChange, title, className = "", isDark }) {
    const [previewColor, setPreviewColor] = useState(value);

    // Sync preview with prop
    useEffect(() => {
        setPreviewColor(value);
    }, [value]);

    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);
    const buttonRef = useRef(null);
    const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                // Also check if click is inside the portal-rendered popup
                const popup = document.getElementById("color-menu-portal");
                if (popup && popup.contains(e.target)) return;
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPopupPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
        }
    }, [open]);

    return (
        <div
            ref={wrapperRef}
            className={`relative ${className}`}
            title={title}
            onPointerDown={e => e.stopPropagation()}
        >
            <button
                ref={buttonRef}
                type="button"
                className={`btn btn-xs btn-ghost p-0 h-6 w-6 min-h-0 rounded-full border ${isDark ? "border-white/20 shadow-none" : "border-base-200 shadow-sm"} overflow-hidden`}
                style={{ backgroundColor: (value === "none" ? "transparent" : (value || "#1e1e1e")), position: "relative" }}
                onClick={() => setOpen(!open)}
            >
                {value === "none" && <div className="absolute inset-0 bg-base-300" style={{ clipPath: "polygon(0 0, 100% 100%, 100% 90%, 10% 0)" }} />}
                <div className="absolute inset-0 hover:bg-black/10 transition-colors" />
            </button>
            {open && ReactDOM.createPortal(
                <div
                    id="color-menu-portal"
                    className="p-2 w-40 flex flex-wrap gap-1.5 rounded-lg z-[9999]"
                    style={{
                        position: 'fixed',
                        top: popupPos.top,
                        left: popupPos.left,
                        transform: 'translate(-50%, -100%)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        background: 'rgba(255,255,255,0.15)',
                        border: '1px solid rgba(255,255,255,0.5)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                        pointerEvents: 'auto'
                    }}
                    onPointerDown={e => e.stopPropagation()}
                >
                    {COLORS.map(c => (
                        <button
                            key={c}
                            className={`w-6 h-6 rounded-md border ${isDark ? "border-white/10" : "border-base-200"} transition-all hover:scale-110 active:scale-95 ${value === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
                            style={{ backgroundColor: c === "none" ? "transparent" : c, position: "relative", overflow: "hidden" }}
                            onClick={() => {
                                onChange(c);
                                setOpen(false);
                            }}
                        >
                            {c === "none" && <div className="absolute inset-0 bg-red-500" style={{ clipPath: "polygon(0 85%, 100% 15%, 100% 25%, 0 95%)" }} />}
                        </button>
                    ))}
                    <div className={`w-full border-t border-white/20 my-1`} />
                    <div className="w-full flex justify-center">
                        <input
                            type="color"
                            value={previewColor === "none" ? "#ffffff" : previewColor}
                            onInput={e => {
                                setPreviewColor(e.target.value);
                                onChange(e.target.value, false); // Live preview ONLY
                            }}
                            onChange={e => {
                                onChange(e.target.value, true); // Final commit for history
                            }}
                            className="w-full h-6 cursor-pointer opacity-80 hover:opacity-100 transition-opacity rounded bg-transparent border-none"
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export const MemoizedColorMenu = React.memo(ColorMenu);
