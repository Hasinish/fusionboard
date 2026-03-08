import React from "react";
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Trash2 } from "lucide-react";
import { FONTS } from "./constants";
import { MemoizedColorMenu } from "./ColorMenu";

export function SelectionToolbar({ selectedItems, updateStyle, handleDelete, activeBounds, camera, isDark, isViewer = false }) {
    if (isViewer) return null;
    const toolbarBtnClass = isDark ? "text-white" : "text-base-content/80";
    return (
        <div
            className="ui-container fixed bg-white/15 backdrop-blur-lg border border-white/50 rounded-lg shadow-2xl px-2 py-1.5 flex items-center gap-1 z-50 flex-nowrap shrink-0 animate-in fade-in zoom-in duration-200"
            style={{
                top: Math.max(80, (activeBounds.y * camera.z + camera.y) - 110),
                left: (activeBounds.x * camera.z + camera.x) + (activeBounds.w * camera.z) / 2,
                transform: "translateX(-50%)",
                pointerEvents: "auto",
                minWidth: "max-content",
            }}
            onPointerDown={e => e.stopPropagation()}
        >
            {(() => {
                const first = selectedItems[0];
                const isAllSameType = selectedItems.every(ei => ei.type === first.type);

                return (
                    <>
                        {isAllSameType && first.type === "path" ? (
                            <div className="flex items-center gap-1 px-1">
                                <MemoizedColorMenu value={first.color || "#000"} onChange={(c, persist = true) => updateStyle({ color: c }, persist)} title="Stroke Color" isDark={isDark} />
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-1 px-1">
                                    <div className={`flex items-center gap-1.5 bg-white/10 p-1 rounded-lg`}>
                                        <MemoizedColorMenu value={first.fill} onChange={(f, persist = true) => updateStyle({ fill: f }, persist)} title="Fill Color" isDark={isDark} />
                                        <MemoizedColorMenu value={first.stroke} onChange={(s, persist = true) => updateStyle({ stroke: s }, persist)} title="Border Color" isDark={isDark} />
                                    </div>
                                    {(first.strokeWidth !== undefined) && (
                                        <input type="range" min="0" max="10" value={first.strokeWidth} onChange={e => updateStyle({ strokeWidth: Number(e.target.value) })} className="range range-xs range-primary w-12" title="Border Width" />
                                    )}
                                </div>

                                {first.text !== undefined && (
                                    <>
                                        <div className="w-px h-6 bg-white/20 mx-1" />
                                        <div className="flex items-center gap-1 px-1">
                                            <MemoizedColorMenu value={first.textColor} onChange={(c, persist = true) => updateStyle({ textColor: c }, persist)} title="Text Color" isDark={isDark} />
                                            <select className={`select select-xs ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-base-200 border-base-300"} select-bordered`} style={{ width: "110px", fontSize: "11px" }} value={first.fontFamily || "Inter"} onChange={e => updateStyle({ fontFamily: e.target.value })} title="Font Family">
                                                {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f, backgroundColor: isDark ? "#1f1f1f" : "white" }}>{f}</option>)}
                                            </select>
                                            <input type="number" min="8" max="120" value={first.fontSize || 16} onChange={e => updateStyle({ fontSize: Number(e.target.value) })} className={`input input-xs ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-base-200 border-base-300"} input-bordered w-14 text-center`} title="Font Size" />
                                            <div className="flex gap-0.5">
                                                <button className={`btn btn-xs btn-ghost ${toolbarBtnClass} ${first.bold ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ bold: !first.bold })} title="Bold"><Bold size={12} /></button>
                                                <button className={`btn btn-xs btn-ghost ${toolbarBtnClass} ${first.italic ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ italic: !first.italic })} title="Italic"><Italic size={12} /></button>
                                            </div>
                                            <div className="w-px h-4 bg-white/20 mx-0.5" />
                                            <div className="flex gap-0.5">
                                                <button className={`btn btn-xs btn-ghost ${toolbarBtnClass} ${first.textAlign === "left" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textAlign: "left" })} title="Align Left"><AlignLeft size={12} /></button>
                                                <button className={`btn btn-xs btn-ghost ${toolbarBtnClass} ${first.textAlign === "center" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textAlign: "center" })} title="Align Center"><AlignCenter size={12} /></button>
                                                <button className={`btn btn-xs btn-ghost ${toolbarBtnClass} ${first.textAlign === "right" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textAlign: "right" })} title="Align Right"><AlignRight size={12} /></button>
                                            </div>
                                            <div className="w-px h-4 bg-white/20 mx-0.5" />
                                            <div className="flex gap-0.5">
                                                <button className={`btn btn-xs btn-ghost ${toolbarBtnClass} ${first.textVerticalAlign === "top" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textVerticalAlign: "top" })} title="Align Top"><AlignVerticalJustifyStart size={12} /></button>
                                                <button className={`btn btn-xs btn-ghost ${toolbarBtnClass} ${first.textVerticalAlign === "middle" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textVerticalAlign: "middle" })} title="Align Middle"><AlignVerticalJustifyCenter size={12} /></button>
                                                <button className={`btn btn-xs btn-ghost ${toolbarBtnClass} ${first.textVerticalAlign === "bottom" ? "btn-active bg-primary/20" : ""}`} onClick={() => updateStyle({ textVerticalAlign: "bottom" })} title="Align Bottom"><AlignVerticalJustifyEnd size={12} /></button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                        <div className="w-px h-6 bg-white/20 mx-1" />
                        <button className="btn btn-xs btn-ghost btn-square text-red-500 hover:bg-error/10" onClick={handleDelete} title="Delete element"><Trash2 size={12} /></button>
                    </>
                );
            })()}
        </div>
    );
}

export default SelectionToolbar;
