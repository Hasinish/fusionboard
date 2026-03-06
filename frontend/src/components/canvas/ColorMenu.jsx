import React, { useState, useEffect } from "react";
import { COLORS } from "./constants";

export function ColorMenu({ value, onChange, title, className = "" }) {
    const [previewColor, setPreviewColor] = useState(value);

    // Sync preview with prop
    useEffect(() => {
        setPreviewColor(value);
    }, [value]);

    return (
        <details className={`dropdown dropdown-top ${className}`} title={title}>
            <summary className="btn btn-xs btn-ghost p-0 h-6 w-6 min-h-0 rounded-full border border-base-200 shadow-sm overflow-hidden" style={{ backgroundColor: (value === "none" ? "transparent" : (value || "#1e1e1e")), position: "relative" }}>
                {value === "none" && <div className="absolute inset-0 bg-base-300" style={{ clipPath: "polygon(0 0, 100% 100%, 100% 90%, 10% 0)" }} />}
                <div className="absolute inset-0 hover:bg-black/10 transition-colors" />
            </summary>
            <div className="dropdown-content z-[100] p-2 shadow-2xl bg-base-100 border border-base-200 rounded-xl w-40 flex flex-wrap gap-1.5 mb-2">
                {COLORS.map(c => (
                    <button
                        key={c}
                        className={`w-6 h-6 rounded-md border border-base-200 transition-all hover:scale-110 active:scale-95 ${value === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
                        style={{ backgroundColor: c === "none" ? "transparent" : c, position: "relative", overflow: "hidden" }}
                        onClick={(e) => {
                            onChange(c);
                            e.currentTarget.closest("details").open = false;
                        }}
                    >
                        {c === "none" && <div className="absolute inset-0 bg-red-500" style={{ clipPath: "polygon(0 85%, 100% 15%, 100% 25%, 0 95%)" }} />}
                    </button>
                ))}
                <div className="w-full border-t border-base-200 my-1" />
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
                        className="w-full h-6 cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                    />
                </div>
            </div>
        </details>
    );
}

export const MemoizedColorMenu = React.memo(ColorMenu);
