import React from "react";
import { RotateCcw } from "lucide-react";
export function GroupSelectionBox({
    selectedIds,
    groupBounds,
    selectionRotation,
    tState,
    camera,
    editingId,
    onGroupTransformStart,
    handleSelect,
    setSelectedIds,
    boardStore,
    pointHitsElement
}) {
    if (selectedIds.length <= 1 || !groupBounds || editingId) return null;

    const activeBounds = tState?.groupBounds || groupBounds;

    const groupHandles = [
        { id: "nw", top: -6, left: -6, cursor: "nw-resize" },
        { id: "ne", top: -6, right: -6, cursor: "ne-resize" },
        { id: "sw", bottom: -6, left: -6, cursor: "sw-resize" },
        { id: "se", bottom: -6, right: -6, cursor: "se-resize" },
    ];

    return (
        <div
            className="absolute border-2 border-primary pointer-events-auto rounded-sm ring-4 ring-primary/5 shadow-[0_0_15px_rgba(37,99,235,0.15)]"
            style={{
                left: activeBounds.x * camera.z + camera.x - 4,
                top: activeBounds.y * camera.z + camera.y - 4,
                width: activeBounds.w * camera.z + 8,
                height: activeBounds.h * camera.z + 8,
                zIndex: 20,
                transformOrigin: "center center",
                transform: `rotate(${selectionRotation || 0}deg)`,
                cursor: tState?.type === "move" ? "grabbing" : "grab", backgroundColor: "rgba(0,0,0,0)"
            }}
            onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // 1. Calculate world point
                const rect = e.currentTarget.parentElement.getBoundingClientRect();
                const wp = {
                    x: (e.clientX - rect.left - camera.x) / camera.z,
                    y: (e.clientY - rect.top - camera.y) / camera.z
                };

                // 2. Precision yield check (unselected ONLY)
                // We check if an unselected element is hit precisely under the group box
                const elementsCopy = [...(boardStore?.getOrderedElements?.() || [])].reverse();

                if (e.shiftKey) {
                    const hitElement = elementsCopy.find(el => pointHitsElement(wp.x, wp.y, el));
                    if (hitElement) {
                        if (selectedIds.includes(hitElement.id)) {
                            setSelectedIds(prev => prev.filter(id => id !== hitElement.id));
                        } else {
                            setSelectedIds(prev => [...prev, hitElement.id]);
                        }
                        return;
                    }
                }

                const hitUnselected = elementsCopy.find(el =>
                    !selectedIds.includes(el.id) && pointHitsElement(wp.x, wp.y, el)
                );

                if (hitUnselected) {
                    handleSelect(hitUnselected.id, e.shiftKey);
                    return;
                }

                // 3. Otherwise, drag the group
                onGroupTransformStart("move", e);
            }}
        >
            {/* Rotation Handle */}
            <div
                className="absolute -top-12 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-base-100 border-2 border-primary flex items-center justify-center cursor-alias hover:bg-primary hover:text-white transition-all shadow-md group pointer-events-auto"
                onPointerDown={(e) => onGroupTransformStart("rotate", e)}
                title="Rotate (Hold Shift to snap)"
            >
                <RotateCcw size={16} />
                <div className="absolute top-10 w-0.5 h-4 bg-primary" />
            </div>

            {/* Scale Handles */}
            {groupHandles.map(h => (
                <div
                    key={h.id}
                    className="absolute w-4 h-4 bg-base-100 border-2 border-primary rounded-sm shadow-sm hover:scale-125 transition-transform pointer-events-auto"
                    style={{
                        ...h,
                        cursor: h.cursor,
                        transform: `translate(${h.left === -6 ? '-50%' : '50%'}, ${h.top === -6 ? '-50%' : '50%'})`
                    }}
                    onPointerDown={(e) => onGroupTransformStart(`scale-${h.id}`, e)}
                />
            ))}
        </div>
    );
}

export default GroupSelectionBox;
