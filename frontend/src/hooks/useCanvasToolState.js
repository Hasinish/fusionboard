import { useState, useEffect, useRef } from "react";

/**
 * Hook to manage tool, color, theme, and background state.
 */
export function useCanvasToolState(isViewer) {
    const [tool, setTool] = useState(isViewer ? "hand" : "pen");
    const [color, setColor] = useState("#000000");
    const [width, setWidth] = useState(2);
    const [bgMode, setBgMode] = useState("white");
    const [isDark, setIsDark] = useState(false);
    const [shapeType, setShapeType] = useState("rect");
    const [lastShapeType, setLastShapeType] = useState("rect");

    const toolRef = useRef(tool);
    useEffect(() => {
        toolRef.current = tool;
    }, [tool]);

    const isViewerRef = useRef(isViewer);
    useEffect(() => {
        isViewerRef.current = isViewer;
    }, [isViewer]);

    // Force hand tool for viewers
    useEffect(() => {
        if (isViewer) setTool("hand");
    }, [isViewer]);

    // Automatic color adjustment based on theme
    useEffect(() => {
        if (isDark) {
            setColor("#ffffff");
        } else {
            setColor("#000000");
        }
    }, [isDark]);

    const toolbarClass = isDark ? "bg-[#1f1f1f] border-[#333333] text-white/70" : "bg-base-100/95 border-base-200";
    const ghostBtnClass = isDark ? "btn-ghost text-white/90 hover:text-white hover:bg-white/10" : "btn-ghost";

    return {
        tool, setTool, toolRef,
        isViewerRef,
        color, setColor,
        width, setWidth,
        bgMode, setBgMode,
        isDark, setIsDark,
        shapeType, setShapeType,
        lastShapeType, setLastShapeType,
        toolbarClass, ghostBtnClass
    };
}

export default useCanvasToolState;
