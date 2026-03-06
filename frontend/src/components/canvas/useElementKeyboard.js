import { useEffect } from "react";

export function useElementKeyboard({ selectedIds, editingId, handleDelete }) {
    useEffect(() => {
        const onKey = (e) => {
            if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0 && !editingId) {
                if (
                    document.activeElement.tagName === "INPUT" ||
                    document.activeElement.tagName === "TEXTAREA" ||
                    document.activeElement.contentEditable === "true"
                ) {
                    return;
                }
                e.preventDefault();
                handleDelete();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedIds, editingId, handleDelete]);
}
